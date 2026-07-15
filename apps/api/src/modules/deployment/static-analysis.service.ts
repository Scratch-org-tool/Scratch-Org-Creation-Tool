import { createHash, randomUUID } from 'node:crypto';
import { execFile, type ExecFileException } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { Injectable } from '@nestjs/common';
import type { StaticAnalysisIssue } from '@sfcc/shared';

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
    let child: ReturnType<typeof execFile>;
    const promise = new Promise<ExecFileResult>((resolve) => {
      child = execFile(
        file,
        [...args],
        {
          cwd: options.cwd,
          timeout: options.timeoutMs,
          maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
          windowsHide: true,
          shell: false,
        },
        (error: ExecFileException | null, stdout, stderr) => {
          resolve({
            exitCode: typeof error?.code === 'number' ? error.code : error ? 1 : 0,
            stdout: String(stdout ?? ''),
            stderr: String(stderr ?? ''),
            timedOut: Boolean(error?.killed && error?.signal),
          });
        },
      );
    });
    return {
      promise,
      kill: () => {
        if (child && !child.killed) child.kill('SIGTERM');
      },
    };
  }
}

export interface StaticAnalysisRunResult {
  availableEngines: string[];
  unavailableEngines: string[];
  skippedEngines: Array<{ engine: string; reason: string }>;
  issues: StaticAnalysisIssue[];
  artifacts: Array<{ engine: string; path: string }>;
  timedOut: boolean;
}

type Engine = 'code-analyzer' | 'pmd' | 'eslint';

@Injectable()
export class StaticAnalysisService {
  constructor(private readonly runner: SafeExecFileAdapter) {}

  async detectAvailability(engines: readonly string[]): Promise<Record<string, boolean>> {
    const entries = await Promise.all(
      [...new Set(engines)].map(async (raw) => {
        const engine = normalizeEngine(raw);
        if (!engine) return [raw, false] as const;
        const command = this.command(engine);
        const result = await this.runner.run(command.file, command.versionArgs, {
          timeoutMs: 10_000,
        }).promise;
        return [raw, result.exitCode === 0] as const;
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
  }): Promise<StaticAnalysisRunResult> {
    const timeoutMs = input.timeoutMs ?? Number(process.env.CODE_ANALYZER_TIMEOUT_MS ?? 10 * 60_000);
    const outputDir = path.join(tmpdir(), 'sfcc-code-analysis', randomUUID());
    fs.mkdirSync(outputDir, { recursive: true });
    const availability = await this.detectAvailability(input.engines);
    const result: StaticAnalysisRunResult = {
      availableEngines: [],
      unavailableEngines: [],
      skippedEngines: [],
      issues: [],
      artifacts: [],
      timedOut: false,
    };

    for (const requested of [...new Set(input.engines)]) {
      const engine = normalizeEngine(requested);
      if (!engine || !availability[requested]) {
        result.unavailableEngines.push(requested);
        continue;
      }
      if (!this.isApplicable(engine, input.projectRoot)) {
        result.skippedEngines.push({ engine: requested, reason: 'No applicable source files found' });
        continue;
      }

      result.availableEngines.push(requested);
      const outputPath = path.join(outputDir, `${engine}.json`);
      const command = this.command(engine, input.projectRoot, outputPath);
      const execution = this.runner.run(command.file, command.args, {
        cwd: input.projectRoot,
        timeoutMs,
      });
      input.registerKill?.(execution.kill);
      let completed: ExecFileResult;
      try {
        completed = await execution.promise;
      } finally {
        input.clearKill?.();
      }
      result.timedOut ||= completed.timedOut;

      const raw = readAnalyzerOutput(outputPath, completed.stdout);
      if (raw !== undefined) {
        fs.writeFileSync(outputPath, JSON.stringify(raw, null, 2), 'utf8');
        result.artifacts.push({ engine: requested, path: outputPath });
        result.issues.push(...normalizeAnalyzerIssues(requested, raw));
      }
      if (completed.exitCode !== 0 && result.issues.length === 0) {
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
  }

  private command(
    engine: Engine,
    projectRoot?: string,
    outputPath?: string,
  ): { file: string; versionArgs: string[]; args: string[] } {
    if (engine === 'code-analyzer') {
      return {
        file: process.env.SF_CLI_PATH?.trim() || 'sf',
        versionArgs: ['code-analyzer', '--version'],
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
    if (engine === 'code-analyzer') return true;
    const extensions = engine === 'pmd'
      ? new Set(['.cls', '.trigger', '.java'])
      : new Set(['.js', '.jsx', '.ts', '.tsx']);
    return containsExtension(projectRoot, extensions);
  }
}

function normalizeEngine(value: string): Engine | null {
  const normalized = value.trim().toLowerCase().replace(/^sf-/, '');
  if (normalized === 'salesforce-code-analyzer' || normalized === 'code-analyzer') {
    return 'code-analyzer';
  }
  if (normalized === 'pmd' || normalized === 'eslint') return normalized;
  return null;
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
