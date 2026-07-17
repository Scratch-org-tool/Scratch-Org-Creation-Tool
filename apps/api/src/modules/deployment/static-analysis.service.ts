import { createHash, randomUUID } from 'node:crypto';
import type { ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import spawn from 'cross-spawn';
import { Injectable } from '@nestjs/common';
import type { StaticAnalysisIssue } from '@sfcc/shared';
import { BUILT_IN_ENGINE, runBuiltInAnalysis } from './built-in-analyzer';

export interface ExecFileResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface CancellableExec {
  promise: Promise<ExecFileResult>;
  kill: () => void;
}

export interface ExecFileRunner {
  run(file: string, args: readonly string[], options: {
    cwd?: string;
    timeoutMs: number;
    maxBuffer?: number;
  }): CancellableExec;
}

@Injectable()
export class SafeExecFileAdapter implements ExecFileRunner {
  run(file: string, args: readonly string[], options: {
    cwd?: string;
    timeoutMs: number;
    maxBuffer?: number;
  }): CancellableExec {
    let child: ChildProcess | undefined;
    let timedOut = false;
    let settled = false;
    let stdout = '';
    let stderr = '';
    let timer: NodeJS.Timeout | undefined;
    const maxBuffer = options.maxBuffer ?? 20 * 1024 * 1024;

    const promise = new Promise<ExecFileResult>((resolve) => {
      const finish = (exitCode: number) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve({ exitCode, stdout, stderr, timedOut });
      };
      const append = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
        const text = chunk.toString();
        const current = stream === 'stdout' ? stdout : stderr;
        if (current.length + text.length > maxBuffer) {
          const remaining = Math.max(0, maxBuffer - current.length);
          if (stream === 'stdout') stdout += text.slice(0, remaining);
          else stderr += text.slice(0, remaining);
          stderr += `\nAnalyzer output exceeded ${maxBuffer} bytes and the process was stopped`;
          terminateProcess(child);
          return;
        }
        if (stream === 'stdout') stdout += text;
        else stderr += text;
      };

      const spawned = spawn(
        file,
        [...args],
        {
          cwd: options.cwd,
          env: process.env,
          windowsHide: true,
          detached: process.platform !== 'win32',
        },
      );
      if (!spawned) {
        stderr += 'Failed to start analyzer process';
        finish(1);
        return;
      }
      child = spawned;
      child.stdout?.on('data', (chunk: Buffer) => append('stdout', chunk));
      child.stderr?.on('data', (chunk: Buffer) => append('stderr', chunk));
      child.on('error', (error) => {
        stderr += `${stderr ? '\n' : ''}${error.message}`;
        finish(1);
      });
      child.on('close', (code) => finish(code ?? 1));

      timer = setTimeout(() => {
        timedOut = true;
        stderr += `${stderr ? '\n' : ''}Analyzer timed out after ${options.timeoutMs}ms`;
        terminateProcess(child);
      }, options.timeoutMs);
      timer.unref();
    });
    return {
      promise,
      kill: () => {
        terminateProcess(child);
      },
    };
  }
}

function terminateProcess(child: ChildProcess | undefined): void {
  if (!child || child.killed || !child.pid) return;
  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, 'SIGTERM');
      return;
    } catch {
      // Process may have already left its group; fall through to direct kill.
    }
  }
  try {
    child.kill('SIGTERM');
  } catch {
    // The process exited between the state check and kill.
  }
}

export interface StaticAnalysisRunResult {
  availableEngines: string[];
  unavailableEngines: string[];
  skippedEngines: Array<{ engine: string; reason: string }>;
  issues: StaticAnalysisIssue[];
  artifacts: Array<{ engine: string; content: string; checksum: string; artifactId?: string }>;
  engineResults: Array<{
    engine: string;
    status: 'passed' | 'unavailable' | 'timed_out' | 'crashed' | 'not_applicable';
    exitCode?: number;
    message?: string;
  }>;
  timedOut: boolean;
}

type Engine = 'built-in' | 'code-analyzer' | 'pmd' | 'eslint';

interface AvailabilityCacheEntry {
  expiresAt: number;
  available: boolean;
}

@Injectable()
export class StaticAnalysisService {
  private readonly availabilityCache = new Map<Engine, AvailabilityCacheEntry>();

  constructor(private readonly runner: SafeExecFileAdapter) {}

  /**
   * External engine probes spawn a CLI process, so results are cached for a
   * short TTL. Capabilities and preview requests both consult this, keeping
   * the wizard responsive instead of re-probing three binaries per request.
   */
  async detectAvailability(engines: readonly string[]): Promise<Record<string, boolean>> {
    const entries = await Promise.all(
      [...new Set(engines)].map(async (raw) => {
        const engine = normalizeEngine(raw);
        if (!engine) return [raw, false] as const;
        if (engine === BUILT_IN_ENGINE) return [raw, true] as const;
        const cached = this.availabilityCache.get(engine);
        if (cached && cached.expiresAt > Date.now()) return [raw, cached.available] as const;
        const command = this.command(engine);
        let available = false;
        try {
          const result = await this.runner.run(command.file, command.versionArgs, {
            timeoutMs: 10_000,
          }).promise;
          available = result.exitCode === 0;
        } catch {
          available = false;
        }
        this.availabilityCache.set(engine, {
          available,
          expiresAt: Date.now() + detectionTtlMs(),
        });
        return [raw, available] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  async run(input: {
    projectRoot: string;
    engines: readonly string[];
    timeoutMs?: number;
    registerKill?: (kill: () => void) => void;
    clearKill?: () => void;
    persistArtifact?: (engine: string, content: string) => Promise<string>;
  }): Promise<StaticAnalysisRunResult> {
    const timeoutMs = input.timeoutMs ?? Number(process.env.CODE_ANALYZER_TIMEOUT_MS ?? 10 * 60_000);
    const outputDir = path.join(tmpdir(), 'sfcc-code-analysis', randomUUID());
    fs.mkdirSync(outputDir, { recursive: true });
    const result: StaticAnalysisRunResult = {
      availableEngines: [],
      unavailableEngines: [],
      skippedEngines: [],
      issues: [],
      artifacts: [],
      engineResults: [],
      timedOut: false,
    };
    try {
      const availability = await this.detectAvailability(input.engines);
      for (const requested of [...new Set(input.engines)]) {
        const engine = normalizeEngine(requested);
        if (!engine || !availability[requested]) {
          result.unavailableEngines.push(requested);
          result.engineResults.push({
            engine: requested,
            status: 'unavailable',
            message: 'Requested analyzer is unavailable',
          });
          continue;
        }
        if (!this.isApplicable(engine, input.projectRoot)) {
          result.skippedEngines.push({ engine: requested, reason: 'No applicable source files found' });
          result.engineResults.push({ engine: requested, status: 'not_applicable' });
          continue;
        }

        if (engine === BUILT_IN_ENGINE) {
          result.availableEngines.push(requested);
          try {
            const report = runBuiltInAnalysis(input.projectRoot);
            const content = JSON.stringify(report, null, 2);
            result.artifacts.push({
              engine: requested,
              content,
              checksum: createHash('sha256').update(content).digest('hex'),
              artifactId: await input.persistArtifact?.(requested, content),
            });
            result.issues.push(...report.issues);
            result.engineResults.push({ engine: requested, status: 'passed', exitCode: 0 });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.engineResults.push({ engine: requested, status: 'crashed', message });
            result.issues.push(makeIssue(requested, {
              ruleId: 'ANALYZER_CRASH',
              severity: 'error',
              message,
            }));
          }
          continue;
        }

        result.availableEngines.push(requested);
        const outputPath = path.join(outputDir, `${engine}.json`);
        const command = this.command(engine, input.projectRoot, outputPath);
        let completed: ExecFileResult;
        try {
          const execution = this.runner.run(command.file, command.args, {
            cwd: input.projectRoot,
            timeoutMs,
          });
          input.registerKill?.(execution.kill);
          completed = await execution.promise;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.engineResults.push({ engine: requested, status: 'crashed', message });
          result.issues.push(makeIssue(requested, {
            ruleId: 'ANALYZER_CRASH',
            severity: 'error',
            message,
          }));
          continue;
        } finally {
          input.clearKill?.();
        }
        result.timedOut ||= completed.timedOut;

        const raw = readAnalyzerOutput(outputPath, completed.stdout);
        if (raw !== undefined) {
          const content = JSON.stringify(raw, null, 2);
          result.artifacts.push({
            engine: requested,
            content,
            checksum: createHash('sha256').update(content).digest('hex'),
            artifactId: await input.persistArtifact?.(requested, content),
          });
          result.issues.push(...normalizeAnalyzerIssues(requested, raw));
        }
        // Linters commonly return non-zero when findings exist (ESLint uses 1,
        // PMD uses 4). A parseable report is a completed engine run, not a crash.
        const failed = completed.timedOut || raw === undefined;
        result.engineResults.push({
          engine: requested,
          status: completed.timedOut ? 'timed_out' : failed ? 'crashed' : 'passed',
          exitCode: completed.exitCode,
          ...(failed ? {
            message: completed.timedOut
              ? `Static analysis timed out after ${timeoutMs}ms`
              : completed.stderr.trim() || `${requested} produced no valid report`,
          } : {}),
        });
        if (failed) {
          result.issues.push(makeIssue(requested, {
            ruleId: completed.timedOut ? 'ANALYZER_TIMEOUT' : 'ANALYZER_EXECUTION',
            severity: 'error',
            message: completed.timedOut
              ? `Static analysis timed out after ${timeoutMs}ms`
              : completed.stderr.trim() || `${requested} exited with code ${completed.exitCode}`,
          }));
        }
      }
      return result;
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  }

  private command(
    engine: Exclude<Engine, 'built-in'>,
    projectRoot?: string,
    outputPath?: string,
  ): { file: string; versionArgs: string[]; args: string[] } {
    if (engine === 'code-analyzer') {
      return {
        file: process.env.SF_CLI_PATH?.trim() || 'sf',
        // `code-analyzer` is a command topic and has no root --version flag.
        // Inspecting the plugin is read-only, respects SF_AUTO_INSTALL_PLUGINS,
        // and exits 0 only when the command package is registered.
        versionArgs: ['plugins', 'inspect', 'code-analyzer', '--json'],
        args: ['code-analyzer', 'run', '--workspace', projectRoot!, '--output-file', outputPath!],
      };
    }
    if (engine === 'pmd') {
      return {
        file: process.env.PMD_PATH?.trim() || 'pmd',
        versionArgs: ['--version'],
        args: ['check', '--dir', projectRoot!, '--format', 'json', '--report-file', outputPath!],
      };
    }
    return {
      file: process.env.ESLINT_PATH?.trim() || 'eslint',
      versionArgs: ['--version'],
      args: [projectRoot!, '--format', 'json', '--output-file', outputPath!],
    };
  }

  private isApplicable(engine: Engine, projectRoot: string): boolean {
    if (engine === 'code-analyzer' || engine === BUILT_IN_ENGINE) return true;
    const extensions = engine === 'pmd'
      ? new Set(['.cls', '.trigger', '.java'])
      : new Set(['.js', '.jsx', '.ts', '.tsx']);
    return containsExtension(projectRoot, extensions);
  }
}

function normalizeEngine(value: string): Engine | null {
  const normalized = value.trim().toLowerCase().replace(/^sf-/, '');
  if (normalized === BUILT_IN_ENGINE || normalized === 'builtin' || normalized === 'local') {
    return BUILT_IN_ENGINE;
  }
  if (normalized === 'salesforce-code-analyzer' || normalized === 'code-analyzer') {
    return 'code-analyzer';
  }
  if (normalized === 'pmd' || normalized === 'eslint') return normalized;
  return null;
}

function detectionTtlMs(): number {
  const configured = Number.parseInt(process.env.STATIC_ANALYSIS_DETECT_TTL_MS ?? '', 10);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 0), 3_600_000) : 60_000;
}

function containsExtension(root: string, extensions: Set<string>): boolean {
  const ignored = new Set(['.git', 'node_modules', '.sf', '.sfdx']);
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (extensions.has(path.extname(entry.name).toLowerCase())) return true;
    }
  }
  return false;
}

function readAnalyzerOutput(outputPath: string, stdout: string): unknown {
  const candidates = [
    fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '',
    stdout,
  ];
  for (const candidate of candidates) {
    const start = candidate.search(/[\[{]/);
    if (start < 0) continue;
    try {
      return JSON.parse(candidate.slice(start));
    } catch {
      // Try the next supported output location.
    }
  }
  return undefined;
}

function normalizeAnalyzerIssues(engine: string, raw: unknown): StaticAnalysisIssue[] {
  if (normalizeEngine(engine) === 'eslint' && Array.isArray(raw)) {
    return raw.flatMap((file) => {
      const fileRecord = asRecord(file);
      if (!fileRecord) return [];
      return (Array.isArray(fileRecord.messages) ? fileRecord.messages : []).flatMap((message) => {
        const item = asRecord(message);
        if (!item || !stringValue(item.message)) return [];
        return [makeIssue(engine, {
          ruleId: stringValue(item.ruleId) ?? (item.fatal ? 'ESLINT_FATAL' : 'ESLINT'),
          severity: Number(item.severity) >= 2 ? 'error' : 'warning',
          message: stringValue(item.message)!,
          file: stringValue(fileRecord.filePath),
          line: positiveInt(item.line),
          column: positiveInt(item.column),
        })];
      });
    });
  }
  const records: Record<string, unknown>[] = [];
  collectIssueRecords(raw, records);
  return records.map((record) => {
    const location = asRecord(record.location ?? record.primaryLocation);
    const file = stringValue(record.fileName ?? record.file ?? record.path ?? location?.file);
    const line = positiveInt(record.line ?? record.startLine ?? location?.line);
    const column = positiveInt(record.column ?? record.startColumn ?? location?.column);
    return makeIssue(engine, {
      ruleId: stringValue(record.ruleName ?? record.ruleId ?? record.rule ?? record.code) ?? 'UNKNOWN',
      severity: normalizeSeverity(record.severity ?? record.priority ?? record.category),
      message: stringValue(record.message ?? record.description ?? record.issue) ?? 'Static analysis issue',
      file,
      line,
      column,
      component: stringValue(record.component ?? record.className),
      helpUrl: urlValue(record.url ?? record.helpUrl),
    });
  });
}

function collectIssueRecords(value: unknown, target: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectIssueRecords(item, target);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  const looksLikeIssue = Boolean(
    record.message || record.description || record.issue,
  ) && Boolean(record.rule || record.ruleId || record.ruleName || record.code);
  if (looksLikeIssue) {
    target.push(record);
    return;
  }
  for (const [key, child] of Object.entries(record)) {
    if (['violations', 'issues', 'results', 'files', 'runs'].includes(key)) {
      collectIssueRecords(child, target);
    }
  }
}

function makeIssue(
  engine: string,
  issue: Omit<StaticAnalysisIssue, 'engine' | 'fingerprint'>,
): StaticAnalysisIssue {
  const fingerprint = createHash('sha256')
    .update([engine, issue.ruleId, issue.file, issue.line, issue.message].join('|'))
    .digest('hex');
  return { engine, ...issue, fingerprint };
}

function normalizeSeverity(value: unknown): StaticAnalysisIssue['severity'] {
  if (typeof value === 'number') {
    if (value <= 1) return 'critical';
    if (value === 2) return 'error';
    if (value === 3) return 'warning';
    return 'info';
  }
  const text = String(value ?? '').toLowerCase();
  if (text.includes('critical') || text.includes('fatal') || text === '1') return 'critical';
  if (text.includes('error') || text.includes('high') || text === '2') return 'error';
  if (text.includes('warn') || text.includes('moderate') || text === '3') return 'warning';
  return 'info';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function positiveInt(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function urlValue(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  try {
    return new URL(text).toString();
  } catch {
    return undefined;
  }
}
