import { type ChildProcess } from 'child_process';
// cross-spawn resolves `sf.cmd` on Windows and escapes every argument for
// cmd.exe. Plain child_process.spawn with `shell: true` concatenates args
// unescaped, so any SOQL (spaces, parentheses, newlines) breaks the command
// with errors like "FROM was unexpected at this time.".
import spawn from 'cross-spawn';
import { EventEmitter } from 'events';
import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import * as path from 'node:path';
import { Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const DEFAULT_STREAM_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const TERMINATION_GRACE_MS = 5000;
const DEFAULT_PLUGIN_INSTALL_TIMEOUT_MS = 10 * 60 * 1000;

class CsvLfNormalizer extends Transform {
  private pendingCr = false;
  private bomChecked = false;

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    let input = chunk;
    if (!this.bomChecked) {
      this.bomChecked = true;
      if (input.length >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf) {
        input = input.subarray(3);
      }
    }

    const output = Buffer.allocUnsafe(input.length + 1);
    let inputIndex = 0;
    let outputIndex = 0;

    if (this.pendingCr) {
      output[outputIndex++] = 0x0a;
      if (input[0] === 0x0a) inputIndex = 1;
      this.pendingCr = false;
    }

    for (; inputIndex < input.length; inputIndex += 1) {
      const byte = input[inputIndex];
      if (byte !== 0x0d) {
        output[outputIndex++] = byte;
        continue;
      }
      if (inputIndex + 1 >= input.length) {
        this.pendingCr = true;
      } else {
        output[outputIndex++] = 0x0a;
        if (input[inputIndex + 1] === 0x0a) inputIndex += 1;
      }
    }
    callback(null, output.subarray(0, outputIndex));
  }

  _flush(callback: TransformCallback) {
    if (this.pendingCr) this.push(Buffer.from('\n'));
    callback();
  }
}

export type RequiredSfPluginId = 'sfdmu' | 'code-analyzer';

export interface RequiredSfPluginDefinition {
  id: RequiredSfPluginId;
  label: string;
  installName: string;
  inspectName: string;
  version: string;
  requiredFor: string;
  /** Unsigned installation is never allowed unless explicitly opted in. */
  unsignedTrustName?: string;
}

export interface SfPluginStatus extends RequiredSfPluginDefinition {
  installed: boolean;
  ready: boolean;
  installedVersion?: string;
  action: 'none' | 'missing' | 'installed' | 'updated' | 'failed';
  error?: string;
}

export interface SfCliReadiness {
  checkedAt: string;
  cliAvailable: boolean;
  cliVersion?: string;
  autoInstall: boolean;
  ready: boolean;
  plugins: SfPluginStatus[];
  error?: string;
}

/**
 * This is an explicit allowlist, not a general plugin installer. Plugin code
 * runs with access to authenticated Salesforce orgs, so arbitrary package
 * names must never come from an API request or user input.
 */
export function requiredSfPlugins(
  env: NodeJS.ProcessEnv = process.env,
): RequiredSfPluginDefinition[] {
  return [
    {
      id: 'sfdmu',
      label: 'SFDMU',
      installName: 'sfdmu',
      inspectName: 'sfdmu',
      version: env.SFDMU_PLUGIN_VERSION?.trim() || '5.8.0',
      requiredFor: 'org-to-org upsert, replication, and custom-settings data loads',
      unsignedTrustName: 'sfdmu',
    },
    {
      id: 'code-analyzer',
      label: 'Salesforce Code Analyzer',
      installName: 'code-analyzer',
      inspectName: 'code-analyzer',
      version: env.SF_CODE_ANALYZER_PLUGIN_VERSION?.trim() || '5.14.0',
      requiredFor: 'automatic metadata static analysis',
    },
  ];
}

export interface SfCliOptions {
  cliPath?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface SfCommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** JSON summary returned by `sf apex run test --result-format json`. */
export interface ApexTestRunResult {
  summary?: {
    outcome?: string;
    testsRan?: number;
    passing?: number;
    failing?: number;
    skipped?: number;
    passRate?: string;
    failRate?: string;
    testRunId?: string;
    testExecutionTime?: string;
    orgWideCoverage?: string;
    testRunCoverage?: string;
  };
  tests?: Array<{
    Id?: string;
    ApexClass?: { Name?: string };
    MethodName?: string;
    Outcome?: string;
    RunTime?: number;
    Message?: string | null;
    StackTrace?: string | null;
  }>;
}

export interface StreamLine {
  stream: 'stdout' | 'stderr';
  line: string;
  timestamp: Date;
}

export interface StreamRunOptions {
  json?: boolean;
  cwd?: string;
  /** Hard cap on process runtime; the process is killed and the result marked failed. */
  timeoutMs?: number;
  /** Access to the spawned child process (e.g. to register cancel handlers). */
  onSpawn?: (proc: ChildProcess) => void;
}

/** Convert a Salesforce `--wait` value into a hard process timeout with buffer. */
export function waitMinutesToTimeoutMs(waitMinutes: number, bufferMinutes = 10): number {
  return Math.max(1, waitMinutes + bufferMinutes) * 60_000;
}

export class SfCliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'SfCliError';
  }
}

export interface SfOrgInfo {
  id?: string;
  alias?: string;
  username?: string;
  orgId?: string;
  instanceUrl?: string;
  loginUrl?: string;
  isDevHub?: boolean;
  connectedStatus?: string;
  status?: string;
  expirationDate?: string;
  devHubAlias?: string;
  devHubUsername?: string;
  devHubOrgId?: string;
}

export interface SfInstalledPackage {
  SubscriberPackageId?: string;
  SubscriberPackageVersionId?: string;
  Id?: string;
  Name?: string;
}

export interface SfMetadataTypeInfo {
  xmlName: string;
  directoryName?: string;
  inFolder?: boolean;
  suffix?: string;
}

export interface SfMetadataComponent {
  fullName: string;
  type?: string;
  folderName?: string;
  folder?: string;
  fileName?: string;
  manageableState?: string;
  lastModifiedDate?: string;
  lastModifiedByName?: string;
}

export interface SfMetadataFolder {
  fullName: string;
}

export interface DeployStartOptions {
  /** Apex test classes for RunSpecifiedTests. */
  tests?: string[];
  /** Validate only (check-only deploy). */
  dryRun?: boolean;
  /** Path to destructiveChanges.xml applied after the deploy. */
  postDestructiveChanges?: string;
  cwd?: string;
}

export function formatRecordValues(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => {
      const needsQuote = value.length === 0 || /[\s='\\]/.test(value);
      const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return needsQuote ? `${key}='${escaped}'` : `${key}=${value}`;
    })
    .join(' ');
}

function recordValuesArgs(fields: Record<string, string>): string[] {
  const entries = Object.entries(fields);
  if (entries.length === 0) return [];
  return ['--values', formatRecordValues(fields)];
}

function killProcessGroup(proc: ChildProcess, signal: NodeJS.Signals): void {
  if (!proc.pid) return;
  if (process.platform !== 'win32') {
    try {
      process.kill(-proc.pid, signal);
      return;
    } catch {
      // Fall back to the direct child if it has already left its process group.
    }
  }
  try {
    proc.kill(signal);
  } catch {
    // The process may have exited between the state check and the signal.
  }
}

/** SOQL is whitespace-insensitive; multi-line queries confuse arg parsing and logs. */
function flattenSoqlArg(soql: string): string {
  return soql.replace(/\s+/g, ' ').trim();
}

function configuredStreamTimeout(timeoutMs?: number): number {
  if (timeoutMs !== undefined && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }
  const configured = Number(process.env.SF_STREAM_TIMEOUT_MS ?? DEFAULT_STREAM_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STREAM_TIMEOUT_MS;
}

function envEnabled(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

function configuredPluginInstallTimeout(env: NodeJS.ProcessEnv): number {
  const value = Number(env.SF_PLUGIN_INSTALL_TIMEOUT_MS ?? DEFAULT_PLUGIN_INSTALL_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_PLUGIN_INSTALL_TIMEOUT_MS;
}

function pluginConfigDirectory(env: NodeJS.ProcessEnv): string {
  if (env.SF_PLUGIN_CONFIG_DIR?.trim()) return path.resolve(env.SF_PLUGIN_CONFIG_DIR.trim());
  if (process.platform === 'win32' && env.LOCALAPPDATA?.trim()) {
    return path.join(env.LOCALAPPDATA.trim(), 'sf');
  }
  return path.join(homedir(), '.config', 'sf');
}

function compactCliError(value: string | undefined): string | undefined {
  const normalized = value
    ?.replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\r/g, '')
    .trim();
  if (!normalized) return undefined;
  return normalized.length > 2_000 ? normalized.slice(-2_000) : normalized;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/** Extract the installed version from `sf plugins inspect --json` output. */
export function parseSfPluginVersion(value: unknown): string | undefined {
  const entries = Array.isArray(value) ? value : [value];
  for (const entry of entries) {
    const record = asObject(entry);
    const options = asObject(record?.options);
    for (const candidate of [options?.tag, options?.version, record?.version]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
  }
  return undefined;
}

async function configureUnsignedPluginTrust(
  definition: RequiredSfPluginDefinition,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  if (!definition.unsignedTrustName) return;
  // SFDMU v5 is signed. Keep verification mandatory by default; this opt-in
  // exists only for private/offline registries where an operator has explicitly
  // accepted the plugin's trust boundary.
  if (!envEnabled(env.SF_ALLOW_UNSIGNED_SFDMU, false)) return;

  const directory = pluginConfigDirectory(env);
  const allowlistPath = path.join(directory, 'unsignedPluginAllowList.json');
  await fs.mkdir(directory, { recursive: true });
  let current: unknown = [];
  try {
    current = JSON.parse(await fs.readFile(allowlistPath, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(
        `Could not read Salesforce plugin trust allowlist at ${allowlistPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  if (!Array.isArray(current) || current.some((entry) => typeof entry !== 'string')) {
    throw new Error(`Salesforce plugin trust allowlist at ${allowlistPath} must be a JSON string array`);
  }
  const values = new Set(current as string[]);
  values.add(definition.unsignedTrustName);
  await fs.writeFile(allowlistPath, `${JSON.stringify([...values].sort(), null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

async function acquirePluginInstallFileLock(
  env: NodeJS.ProcessEnv,
): Promise<() => Promise<void>> {
  const directory = pluginConfigDirectory(env);
  await fs.mkdir(directory, { recursive: true });
  const lockPath = path.join(directory, '.sfcc-plugin-install.lock');
  const timeoutMs = configuredPluginInstallTimeout(env);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const handle = await fs.open(lockPath, 'wx', 0o600);
      await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`);
      return async () => {
        await handle.close().catch(() => undefined);
        await fs.unlink(lockPath).catch(() => undefined);
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // Recover a lock abandoned by a killed installer.
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > timeoutMs + 60_000) {
          await fs.unlink(lockPath);
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === 'ENOENT') continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Timed out waiting ${timeoutMs}ms for another Salesforce plugin installation`);
}

const pluginInstallPromises = new Map<RequiredSfPluginId, Promise<SfPluginStatus>>();

export class SfCliClient extends EventEmitter {
  private readonly cliPath: string;
  private readonly cwd: string;
  private readonly env: NodeJS.ProcessEnv;

  constructor(options: SfCliOptions = {}) {
    super();
    this.cliPath = options.cliPath ?? process.env.SF_CLI_PATH ?? 'sf';
    this.cwd = options.cwd ?? process.cwd();
    this.env = { ...process.env, ...options.env };
  }

  private async prepareBulkCsv(file: string, cwd?: string) {
    const sourcePath = path.isAbsolute(file) ? file : path.resolve(cwd ?? this.cwd, file);
    const normalizedPath = path.join(
      tmpdir(),
      `sfcc-bulk-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`,
    );
    try {
      await pipeline(
        createReadStream(sourcePath),
        new CsvLfNormalizer(),
        createWriteStream(normalizedPath, { flags: 'wx' }),
      );
      return {
        file: normalizedPath,
        cleanup: () => fs.rm(normalizedPath, { force: true }),
      };
    } catch (error) {
      await fs.rm(normalizedPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async run<T = unknown>(
    args: string[],
    options?: { json?: boolean; timeout?: number; cwd?: string },
  ): Promise<SfCommandResult<T>> {
    const cmdArgs = options?.json ? [...args, '--json'] : args;
    return this.execute<T>(cmdArgs, options?.timeout, undefined, options?.cwd);
  }

  async runStreaming(
    args: string[],
    onLine?: (line: StreamLine) => void,
    options?: StreamRunOptions,
  ): Promise<SfCommandResult> {
    return this.runStreamingCancellable(args, onLine, options).promise;
  }

  runStreamingCancellable(
    args: string[],
    onLine?: (line: StreamLine) => void,
    options?: StreamRunOptions,
  ): { promise: Promise<SfCommandResult>; kill: () => void } {
    let proc: ChildProcess | null = null;
    let timedOut = false;
    let cancelled = false;
    const cmdArgs = options?.json ? [...args, '--json'] : args;
    const timeoutMs = configuredStreamTimeout(options?.timeoutMs);
    let cancelProcess = () => {
      cancelled = true;
    };

    const promise = new Promise<SfCommandResult>((resolve) => {
      proc = spawn(this.cliPath, cmdArgs, {
        cwd: options?.cwd ?? this.cwd,
        env: this.env,
        detached: process.platform !== 'win32',
      });

      options?.onSpawn?.(proc);

      let stdout = '';
      let stderr = '';
      let closed = false;
      let settled = false;
      let killTimer: NodeJS.Timeout | undefined;
      const partial: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };

      const terminate = () => {
        if (!proc || closed) return;
        killProcessGroup(proc, 'SIGTERM');
        killTimer = setTimeout(() => {
          if (proc) killProcessGroup(proc, 'SIGKILL');
        }, TERMINATION_GRACE_MS);
      };

      const timer = setTimeout(() => {
        timedOut = true;
        terminate();
      }, timeoutMs);
      timer.unref();

      const emitLine = (stream: 'stdout' | 'stderr', line: string) => {
        const event: StreamLine = { stream, line, timestamp: new Date() };
        this.emit('line', event);
        onLine?.(event);
      };

      const handleData = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
        const text = chunk.toString();
        if (stream === 'stdout') stdout += text;
        else stderr += text;

        const lines = (partial[stream] + text).split('\n');
        partial[stream] = lines.pop() ?? '';
        for (const line of lines) {
          emitLine(stream, line.endsWith('\r') ? line.slice(0, -1) : line);
        }
      };

      proc.stdout?.on('data', handleData('stdout'));
      proc.stderr?.on('data', handleData('stderr'));

      proc.on('close', (code) => {
        closed = true;
        clearTimeout(timer);
        if (killTimer && !timedOut && !cancelled) clearTimeout(killTimer);
        for (const stream of ['stdout', 'stderr'] as const) {
          if (partial[stream]) emitLine(stream, partial[stream]);
        }
        if (settled) return;
        settled = true;
        if (timedOut) {
          resolve({
            success: false,
            error: `Command timed out after ${Math.ceil(timeoutMs / 60000)} minute(s)`,
            stdout,
            stderr,
            exitCode: 124,
          });
          return;
        }
        const exitCode = cancelled ? 130 : (code ?? 1);
        resolve(this.parseResult(stdout, stderr, exitCode));
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        if (killTimer && !timedOut && !cancelled) clearTimeout(killTimer);
        if (settled) return;
        settled = true;
        resolve({
          success: false,
          error: err.message,
          stdout,
          stderr: err.message,
          exitCode: timedOut ? 124 : cancelled ? 130 : 1,
        });
      });

      // The returned cancellation closure and timeout callback share this
      // function without exposing the child outside the client.
      cancelProcess = () => {
        cancelled = true;
        terminate();
      };
    });

    return {
      promise,
      kill: () => cancelProcess(),
    };
  }

  private execute<T>(
    args: string[],
    timeout?: number,
    onProcess?: (proc: ChildProcess) => void,
    cwd?: string,
  ): Promise<SfCommandResult<T>> {
    return new Promise((resolve) => {
      const proc = spawn(this.cliPath, args, {
        cwd: cwd ?? this.cwd,
        env: this.env,
        detached: process.platform !== 'win32',
      });

      onProcess?.(proc);

      let stdout = '';
      let stderr = '';
      let killed = false;
      let killTimer: NodeJS.Timeout | undefined;

      const timer = timeout
        ? setTimeout(() => {
            killed = true;
            killProcessGroup(proc, 'SIGTERM');
            killTimer = setTimeout(() => {
              killProcessGroup(proc, 'SIGKILL');
            }, TERMINATION_GRACE_MS);
          }, timeout)
        : undefined;
      timer?.unref();

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        if (killTimer && !killed) clearTimeout(killTimer);
        const exitCode = killed ? 124 : (code ?? 1);
        resolve(this.parseResult<T>(stdout, stderr, exitCode));
      });

      proc.on('error', (err) => {
        if (timer) clearTimeout(timer);
        if (killTimer && !killed) clearTimeout(killTimer);
        resolve({
          success: false,
          error: err.message,
          stdout,
          stderr: err.message,
          exitCode: 1,
        });
      });
    });
  }

  runCancellable<T = unknown>(
    args: string[],
    options?: { json?: boolean; timeout?: number },
  ): { promise: Promise<SfCommandResult<T>>; kill: () => void } {
    let proc: ChildProcess | null = null;
    const cmdArgs = options?.json ? [...args, '--json'] : args;
    const promise = this.execute<T>(cmdArgs, options?.timeout, (p) => {
      proc = p;
    });
    return {
      promise,
      kill: () => {
        if (proc) {
          killProcessGroup(proc, 'SIGTERM');
          const killTimer = setTimeout(() => {
            if (proc) killProcessGroup(proc, 'SIGKILL');
          }, 2000);
        }
      },
    };
  }

  private parseResult<T>(stdout: string, stderr: string, exitCode: number): SfCommandResult<T> {
    if (exitCode !== 0) {
      const jsonError = this.tryParseJson<{ message?: string; name?: string }>(stdout || stderr);
      return {
        success: false,
        error: jsonError?.message ?? (stderr || stdout || `Command failed with exit code ${exitCode}`),
        stdout,
        stderr,
        exitCode,
      };
    }

    const data = this.tryParseJson<T>(stdout);
    return { success: true, data, stdout, stderr, exitCode };
  }

  private tryParseJson<T>(text: string): T | undefined {
    try {
      const trimmed = text.trim();
      if (!trimmed) return undefined;
      const jsonStart = trimmed.indexOf('{');
      const jsonArrStart = trimmed.indexOf('[');
      const start = jsonStart >= 0 && (jsonArrStart < 0 || jsonStart < jsonArrStart) ? jsonStart : jsonArrStart;
      if (start < 0) return undefined;
      return JSON.parse(trimmed.slice(start)) as T;
    } catch {
      return undefined;
    }
  }

  // Org commands
  async loginWeb(alias: string, instanceUrl?: string, isDevHub?: boolean): Promise<SfCommandResult> {
    return this.loginWebCancellable(alias, instanceUrl, isDevHub).promise;
  }

  loginWebCancellable(
    alias: string,
    instanceUrl?: string,
    isDevHub?: boolean,
  ): { promise: Promise<SfCommandResult>; kill: () => void } {
    const args = ['org', 'login', 'web', '--alias', alias];
    if (instanceUrl) args.push('--instance-url', instanceUrl);
    if (isDevHub) args.push('--set-default-dev-hub');
    return this.runCancellable(args, { json: true, timeout: 300000 });
  }

  async logout(alias: string): Promise<SfCommandResult> {
    return this.run(['org', 'logout', '--target-org', alias, '--no-prompt'], { json: true });
  }

  async listOrgs(): Promise<SfCommandResult<{ result: { nonScratchOrgs: SfOrgInfo[]; scratchOrgs: SfOrgInfo[] } }>> {
    return this.run(['org', 'list', '--json'], { json: true });
  }

  async createScratchOrgFromDef(options: {
    alias: string;
    username: string;
    duration: number;
    definitionFile: string;
    devHubAlias: string;
    waitMinutes?: number;
  }): Promise<SfCommandResult> {
    return this.runStreaming([
      'org', 'create', 'scratch',
      '-f', options.definitionFile,
      '-a', options.alias,
      '--username', options.username,
      '-y', String(options.duration),
      '-w', String(options.waitMinutes ?? 15),
      '--target-dev-hub', options.devHubAlias,
      '--json',
    ]);
  }

  async deployManifest(targetOrg: string, manifestPath: string, testLevel = 'NoTestRun'): Promise<SfCommandResult> {
    const waitMin = Number(process.env.SF_DEPLOY_WAIT_MINUTES ?? 45);
    return this.runStreaming([
      'project', 'deploy', 'start',
      '--manifest', manifestPath,
      '--target-org', targetOrg,
      '--test-level', testLevel,
      '--wait', String(waitMin),
    ], undefined, { json: true, timeoutMs: waitMinutesToTimeoutMs(waitMin) });
  }

  async displayOrg(alias: string): Promise<SfCommandResult> {
    return this.run(['org', 'display', '--target-org', alias], { json: true });
  }

  async createScratchOrg(
    alias: string,
    devHubAlias: string,
    duration: number,
    definitionFile?: string,
  ): Promise<SfCommandResult> {
    const args = [
      'org', 'create', 'scratch',
      '--alias', alias,
      '--target-dev-hub', devHubAlias,
      '--duration-days', String(duration),
      '--set-default',
    ];
    if (definitionFile) args.push('--definition-file', definitionFile);
    return this.runStreaming(args, undefined, { json: true });
  }

  async deleteScratchOrg(alias: string): Promise<SfCommandResult> {
    return this.run(['org', 'delete', 'scratch', '--target-org', alias, '--no-prompt'], { json: true });
  }

  async extendScratchOrg(alias: string, duration: number): Promise<SfCommandResult> {
    return this.run(['org', 'extend', 'scratch', '--target-org', alias, '--duration-days', String(duration)], { json: true });
  }

  async openOrg(alias: string): Promise<SfCommandResult> {
    return this.run(['org', 'open', '--target-org', alias, '--url-only'], { json: true });
  }

  async showUserPassword(targetOrg: string): Promise<SfCommandResult> {
    // Newer CLI (2.138+); older versions return command-not-found — caller handles gracefully
    return this.run([
      'org', 'auth', 'show-user-password',
      '--target-org', targetOrg,
      '--no-prompt',
    ], { json: true });
  }

  async generatePassword(alias: string): Promise<SfCommandResult> {
    return this.run(['org', 'generate', 'password', '--target-org', alias], { json: true });
  }

  // Package commands
  async listInstalledPackages(
    targetOrg: string,
  ): Promise<SfCommandResult<{ result: SfInstalledPackage[] }>> {
    return this.run(
      ['package', 'installed', 'list', '--target-org', targetOrg],
      { json: true },
    );
  }

  async installPackage(packageId: string, targetOrg: string, waitMinutes = 30): Promise<SfCommandResult> {
    return this.installPackageCancellable(packageId, targetOrg, waitMinutes).promise;
  }

  installPackageCancellable(
    packageId: string,
    targetOrg: string,
    waitMinutes = 30,
  ): { promise: Promise<SfCommandResult>; kill: () => void } {
    return this.runStreamingCancellable([
      'package', 'install',
      '--package', packageId,
      '--target-org', targetOrg,
      '--wait', String(waitMinutes),
      '--no-prompt',
    ], undefined, { timeoutMs: waitMinutesToTimeoutMs(waitMinutes) });
  }

  // Deploy commands
  async deployMetadata(alias: string, sourcePath: string, testLevel = 'NoTestRun'): Promise<SfCommandResult> {
    return this.runStreaming([
      'project', 'deploy', 'start',
      '--source-dir', sourcePath,
      '--target-org', alias,
      '--test-level', testLevel,
      '--wait', '30',
    ], undefined, { json: true });
  }

  // Permission sets
  async assignPermissionSet(
    alias: string,
    permissionSet: string,
    options?: { onBehalfOf?: string },
  ): Promise<SfCommandResult> {
    const args = [
      'org', 'assign', 'permset',
      '--name', permissionSet,
      '--target-org', alias,
    ];
    if (options?.onBehalfOf) {
      args.push('--on-behalf-of', options.onBehalfOf);
    }
    return this.run(args, { json: true });
  }

  // Data query
  async query(alias: string, soql: string): Promise<SfCommandResult<{ result: { records: unknown[]; totalSize: number } }>> {
    return this.run(['data', 'query', '--query', flattenSoqlArg(soql), '--target-org', alias], { json: true });
  }

  /**
   * Kick off a sandbox refresh from its production org (requires prod auth).
   * Runs async — Salesforce completes the refresh in the background; poll the
   * sandbox status from Setup or via `sf org resume sandbox`.
   */
  async refreshSandbox(
    prodOrgAlias: string,
    sandboxName: string,
  ): Promise<SfCommandResult> {
    return this.run(
      [
        'org', 'refresh', 'sandbox',
        '--name', sandboxName,
        '--target-org', prodOrgAlias,
        '--no-prompt',
        '--async',
      ],
      { json: true },
    );
  }

  /** SOQL against the Tooling API (ApexOrgWideCoverage, ApexCodeCoverage, …). */
  async queryTooling(
    alias: string,
    soql: string,
  ): Promise<SfCommandResult<{ result: { records: unknown[]; totalSize: number } }>> {
    return this.run(
      ['data', 'query', '--query', flattenSoqlArg(soql), '--target-org', alias, '--use-tooling-api'],
      { json: true },
    );
  }

  /**
   * Run Apex tests asynchronously and wait for the outcome. Returns the CLI
   * JSON summary (per-test results + coverage when requested).
   */
  async runApexTests(
    alias: string,
    options?: {
      testLevel?: 'RunLocalTests' | 'RunAllTestsInOrg' | 'RunSpecifiedTests';
      classNames?: string[];
      waitMinutes?: number;
      codeCoverage?: boolean;
    },
  ): Promise<SfCommandResult<{ result: ApexTestRunResult }>> {
    const waitMinutes = options?.waitMinutes ?? 60;
    const args = [
      'apex', 'run', 'test',
      '--target-org', alias,
      '--test-level', options?.testLevel ?? 'RunLocalTests',
      '--wait', String(waitMinutes),
      '--result-format', 'json',
    ];
    if (options?.codeCoverage !== false) args.push('--code-coverage');
    if (options?.testLevel === 'RunSpecifiedTests') {
      for (const className of options.classNames ?? []) {
        args.push('--class-names', className);
      }
    }
    return this.run(args, { json: true, timeout: waitMinutesToTimeoutMs(waitMinutes) });
  }

  async exportBulk(
    query: string,
    targetOrg: string,
    outputFile: string,
    waitMinutes = 10,
    options?: { cwd?: string; onSpawn?: (proc: ChildProcess) => void },
  ): Promise<SfCommandResult> {
    return this.runStreaming([
      'data', 'export', 'bulk',
      '--query', flattenSoqlArg(query),
      '--target-org', targetOrg,
      '--output-file', outputFile,
      '--result-format', 'csv',
      '--line-ending', 'LF',
      '--wait', String(waitMinutes),
    ], undefined, {
      cwd: options?.cwd,
      onSpawn: options?.onSpawn,
      timeoutMs: waitMinutesToTimeoutMs(waitMinutes),
    });
  }

  async importBulk(
    sobject: string,
    file: string,
    targetOrg: string,
    waitMinutes = 10,
    options?: { cwd?: string; onSpawn?: (proc: ChildProcess) => void },
  ): Promise<SfCommandResult> {
    const csv = await this.prepareBulkCsv(file, options?.cwd);
    try {
      return await this.runStreaming([
        'data', 'import', 'bulk',
        '--sobject', sobject,
        '--file', csv.file,
        '--target-org', targetOrg,
        '--wait', String(waitMinutes),
        '--line-ending', 'LF',
      ], undefined, {
        cwd: options?.cwd,
        onSpawn: options?.onSpawn,
        timeoutMs: waitMinutesToTimeoutMs(waitMinutes),
      });
    } finally {
      await csv.cleanup();
    }
  }

  /** Bulk upsert by external id — safe to re-run (idempotent per external id). */
  async upsertBulkByExternalId(
    sobject: string,
    file: string,
    externalId: string,
    targetOrg: string,
    waitMinutes = 15,
    options?: { cwd?: string; onSpawn?: (proc: ChildProcess) => void },
  ): Promise<SfCommandResult> {
    return this.upsertBulk(sobject, file, externalId, targetOrg, waitMinutes, options);
  }

  async getBulkJobResults(
    targetOrg: string,
    jobId: string,
    options?: { cwd?: string },
  ): Promise<SfCommandResult> {
    return this.run(['data', 'bulk', 'results', '-o', targetOrg, '--job-id', jobId], {
      json: true,
      cwd: options?.cwd,
    });
  }

  // Required Salesforce CLI plugins
  private requiredPlugin(id: RequiredSfPluginId): RequiredSfPluginDefinition {
    const definition = requiredSfPlugins(this.env).find((plugin) => plugin.id === id);
    if (!definition) throw new Error(`Unknown required Salesforce CLI plugin: ${id}`);
    return definition;
  }

  private enforcePluginVersions(): boolean {
    return envEnabled(this.env.SF_ENFORCE_PLUGIN_VERSIONS, true);
  }

  private autoInstallPlugins(): boolean {
    return envEnabled(this.env.SF_AUTO_INSTALL_PLUGINS, true);
  }

  async getCliVersion(): Promise<{ available: boolean; version?: string; error?: string }> {
    const result = await this.run(['--version'], { timeout: 15_000 });
    if (!result.success) {
      return {
        available: false,
        error: compactCliError(result.error) ?? `Salesforce CLI executable "${this.cliPath}" is unavailable`,
      };
    }
    const version = result.stdout.trim().split(/\r?\n/).find(Boolean);
    return { available: true, version };
  }

  async inspectRequiredPlugin(id: RequiredSfPluginId): Promise<SfPluginStatus> {
    const definition = this.requiredPlugin(id);
    const result = await this.run<unknown>(
      ['plugins', 'inspect', definition.inspectName],
      { json: true, timeout: 30_000 },
    );
    const installedVersion = result.success ? parseSfPluginVersion(result.data) : undefined;
    const installed = result.success;
    const versionMatches =
      !this.enforcePluginVersions()
      || definition.version === 'latest'
      || installedVersion === definition.version;
    return {
      ...definition,
      installed,
      ready: installed && versionMatches,
      installedVersion,
      action: installed ? 'none' : 'missing',
      ...(!result.success ? { error: compactCliError(result.error) } : {}),
      ...(installed && !versionMatches ? {
        error: `Installed ${definition.label} version ${installedVersion ?? 'unknown'} does not match required version ${definition.version}`,
      } : {}),
    };
  }

  private async installRequiredPlugin(id: RequiredSfPluginId): Promise<SfPluginStatus> {
    const definition = this.requiredPlugin(id);
    const releaseLock = await acquirePluginInstallFileLock(this.env);
    try {
      // Another API worker may have completed installation while this process
      // waited on the cross-process lock.
      const current = await this.inspectRequiredPlugin(id);
      if (current.ready) return current;

      await configureUnsignedPluginTrust(definition, this.env);
      const installSpec = `${definition.installName}@${definition.version}`;
      const result = await this.run(
        ['plugins', 'install', installSpec],
        { timeout: configuredPluginInstallTimeout(this.env) },
      );
      if (!result.success) {
        return {
          ...current,
          ready: false,
          action: 'failed',
          error: compactCliError(result.error)
            ?? `Failed to install ${definition.label} (${installSpec})`,
        };
      }

      const verified = await this.inspectRequiredPlugin(id);
      if (!verified.ready) {
        return {
          ...verified,
          action: 'failed',
          error: verified.error
            ?? `${definition.label} installation completed but the plugin could not be verified`,
        };
      }
      return {
        ...verified,
        action: current.installed ? 'updated' : 'installed',
        error: undefined,
      };
    } finally {
      await releaseLock();
    }
  }

  async ensureRequiredPlugin(
    id: RequiredSfPluginId,
    options?: { installMissing?: boolean },
  ): Promise<SfPluginStatus> {
    const current = await this.inspectRequiredPlugin(id);
    const installMissing = this.autoInstallPlugins() && (options?.installMissing ?? true);
    if (current.ready || !installMissing) return current;

    const inFlight = pluginInstallPromises.get(id);
    if (inFlight) return inFlight;
    const install = this.installRequiredPlugin(id);
    pluginInstallPromises.set(id, install);
    try {
      return await install;
    } finally {
      if (pluginInstallPromises.get(id) === install) pluginInstallPromises.delete(id);
    }
  }

  async getRequiredPluginsReadiness(
    options?: { installMissing?: boolean },
  ): Promise<SfCliReadiness> {
    const installMissing = this.autoInstallPlugins() && (options?.installMissing ?? true);
    const cli = await this.getCliVersion();
    if (!cli.available) {
      const error =
        cli.error
        ?? `Salesforce CLI executable "${this.cliPath}" is unavailable; install @salesforce/cli first`;
      return {
        checkedAt: new Date().toISOString(),
        cliAvailable: false,
        autoInstall: installMissing,
        ready: false,
        error,
        plugins: requiredSfPlugins(this.env).map((definition) => ({
          ...definition,
          installed: false,
          ready: false,
          action: 'failed',
          error,
        })),
      };
    }

    // Salesforce CLI plugin installation mutates one shared package tree, so
    // provision sequentially even when several plugins are absent.
    const plugins: SfPluginStatus[] = [];
    for (const definition of requiredSfPlugins(this.env)) {
      plugins.push(await this.ensureRequiredPlugin(definition.id, { installMissing }));
    }
    const ready = plugins.every((plugin) => plugin.ready);
    return {
      checkedAt: new Date().toISOString(),
      cliAvailable: true,
      cliVersion: cli.version,
      autoInstall: installMissing,
      ready,
      plugins,
      ...(!ready ? {
        error: plugins
          .filter((plugin) => !plugin.ready)
          .map((plugin) => `${plugin.label}: ${plugin.error ?? 'not ready'}`)
          .join('; '),
      } : {}),
    };
  }

  // SFDMU compatibility helpers
  async getSfdmuPluginStatus(options?: { installMissing?: boolean }): Promise<SfPluginStatus> {
    return this.ensureRequiredPlugin('sfdmu', options);
  }

  async isSfdmuPluginInstalled(): Promise<boolean> {
    return (await this.inspectRequiredPlugin('sfdmu')).installed;
  }

  async ensureSfdmuPlugin(): Promise<void> {
    const status = await this.ensureRequiredPlugin('sfdmu');
    if (!status.ready) {
      throw new SfCliError(
        status.error
          ? `${sfdmuPluginInstallMessage(status.version)}: ${status.error}`
          : sfdmuPluginInstallMessage(status.version),
        1,
        '',
      );
    }
  }

  async ensureCodeAnalyzerPlugin(): Promise<void> {
    const status = await this.ensureRequiredPlugin('code-analyzer');
    if (!status.ready) {
      throw new SfCliError(
        `Salesforce Code Analyzer plugin is unavailable: ${status.error ?? 'automatic provisioning failed'}`,
        1,
        '',
      );
    }
  }

  async runSfdmu(
    sourceAlias: string,
    targetAlias: string,
    path: string,
    onLine?: (line: StreamLine) => void,
    options?: { onSpawn?: (proc: ChildProcess) => void; timeoutMs?: number },
  ): Promise<SfCommandResult> {
    const envTimeout = Number(process.env.SF_SFDMU_TIMEOUT_MINUTES ?? 180);
    const args = [
      'sfdmu', 'run',
      '--sourceusername', sourceAlias,
      '--targetusername', targetAlias,
      '--path', path,
      // Queue workers have no interactive terminal. Never let an SFDMU
      // confirmation prompt leave a chunk running indefinitely.
      '--noprompt',
    ];
    // A normal SFDMU exit can still contain rejected or skipped rows. Strict
    // warning handling prevents those partial writes from being called success.
    if (this.env.SFDMU_FAIL_ON_WARNING?.trim().toLowerCase() !== 'false') {
      args.push('--failonwarning');
    }
    return this.runStreaming(args, onLine, {
      cwd: path,
      onSpawn: options?.onSpawn,
      timeoutMs: options?.timeoutMs ?? waitMinutesToTimeoutMs(envTimeout, 0),
    });
  }

  // User create
  async createUser(alias: string, fields: Record<string, string>): Promise<SfCommandResult> {
    return this.run(['data', 'create', 'record', '--sobject', 'User', ...recordValuesArgs(fields), '--target-org', alias], { json: true });
  }

  async updateUser(alias: string, recordId: string, fields: Record<string, string>): Promise<SfCommandResult> {
    return this.run([
      'data', 'update', 'record', '--sobject', 'User', '--record-id', recordId, ...recordValuesArgs(fields), '--target-org', alias,
    ], { json: true });
  }

  async createRecord(
    alias: string,
    sobject: string,
    fields: Record<string, string>,
  ): Promise<SfCommandResult<{ result: { id: string } }>> {
    return this.run(['data', 'create', 'record', '--sobject', sobject, ...recordValuesArgs(fields), '--target-org', alias], { json: true });
  }

  async updateRecord(
    alias: string,
    sobject: string,
    recordId: string,
    fields: Record<string, string>,
  ): Promise<SfCommandResult> {
    return this.run([
      'data', 'update', 'record', '--sobject', sobject, '--record-id', recordId, ...recordValuesArgs(fields), '--target-org', alias,
    ], { json: true });
  }

  async deleteRecord(alias: string, sobject: string, recordId: string): Promise<SfCommandResult> {
    return this.run(['data', 'delete', 'record', '--sobject', sobject, '--record-id', recordId, '--target-org', alias], { json: true });
  }

  async upsertBulk(
    sobject: string,
    file: string,
    externalId: string,
    targetOrg: string,
    waitMinutes = 15,
    options?: { cwd?: string; onSpawn?: (proc: ChildProcess) => void },
  ): Promise<SfCommandResult> {
    const csv = await this.prepareBulkCsv(file, options?.cwd);
    try {
      return await this.runStreaming([
        'data', 'upsert', 'bulk',
        '-f', csv.file,
        '-s', sobject,
        '-i', externalId,
        '--target-org', targetOrg,
        '--wait', String(waitMinutes),
        '--line-ending', 'LF',
      ], undefined, {
        cwd: options?.cwd,
        onSpawn: options?.onSpawn,
        timeoutMs: waitMinutesToTimeoutMs(waitMinutes),
      });
    } finally {
      await csv.cleanup();
    }
  }

  async updateBulk(
    sobject: string,
    file: string,
    targetOrg: string,
    waitMinutes = 15,
    options?: { cwd?: string; onSpawn?: (proc: ChildProcess) => void },
  ): Promise<SfCommandResult> {
    const csv = await this.prepareBulkCsv(file, options?.cwd);
    try {
      return await this.runStreaming([
        'data', 'update', 'bulk',
        '-f', csv.file,
        '-s', sobject,
        '--target-org', targetOrg,
        '--wait', String(waitMinutes),
        '--line-ending', 'LF',
      ], undefined, {
        cwd: options?.cwd,
        onSpawn: options?.onSpawn,
        timeoutMs: waitMinutesToTimeoutMs(waitMinutes),
      });
    } finally {
      await csv.cleanup();
    }
  }

  async deleteBulk(
    sobject: string,
    file: string,
    targetOrg: string,
    waitMinutes = 15,
    options?: { cwd?: string; onSpawn?: (proc: ChildProcess) => void },
  ): Promise<SfCommandResult> {
    const csv = await this.prepareBulkCsv(file, options?.cwd);
    try {
      return await this.runStreaming([
        'data', 'delete', 'bulk',
        '-f', csv.file,
        '-s', sobject,
        '--target-org', targetOrg,
        '--wait', String(waitMinutes),
        '--line-ending', 'LF',
      ], undefined, {
        cwd: options?.cwd,
        onSpawn: options?.onSpawn,
        timeoutMs: waitMinutesToTimeoutMs(waitMinutes),
      });
    } finally {
      await csv.cleanup();
    }
  }

  async listMetadataTypes(alias: string): Promise<SfCommandResult<{
    result: {
      metadataObjects: SfMetadataTypeInfo[];
    };
  }>> {
    return this.run(['org', 'list', 'metadata-types', '--target-org', alias], { json: true });
  }

  async listMetadata(
    alias: string,
    metadataType: string,
    folder?: string,
  ): Promise<SfCommandResult<{ result: SfMetadataComponent[] }>> {
    const args = ['org', 'list', 'metadata', '--metadata-type', metadataType, '--target-org', alias];
    if (folder) args.push('--folder', folder);
    const result = await this.run<{ result: SfMetadataComponent[] | SfMetadataComponent }>(args, { json: true });
    if (!result.success) return result as SfCommandResult<{ result: SfMetadataComponent[] }>;
    const raw = result.data?.result;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return { ...result, data: { result: list } };
  }

  async listMetadataFolders(
    alias: string,
    metadataType: string,
  ): Promise<SfCommandResult<{ result: SfMetadataFolder[] }>> {
    const result = await this.listMetadata(alias, metadataType);
    if (!result.success) return result as SfCommandResult<{ result: SfMetadataFolder[] }>;
    const folders = new Map<string, SfMetadataFolder>();
    for (const item of result.data?.result ?? []) {
      const folderName = item.folderName ?? item.folder;
      if (folderName && !folders.has(folderName)) {
        folders.set(folderName, { fullName: folderName });
      }
    }
    return { ...result, data: { result: [...folders.values()] } };
  }

  async listSObjects(
    alias: string,
  ): Promise<SfCommandResult<{ result: string[] }>> {
    return this.run(['sobject', 'list', '--sobject', 'all', '--target-org', alias], { json: true });
  }

  async describeSObject(
    alias: string,
    sobject: string,
  ): Promise<SfCommandResult<{
    result: {
      name: string;
      label?: string;
      nameField?: { name: string };
      fields: Array<{
        name: string;
        label?: string;
        type?: string;
        externalId?: boolean;
        idLookup?: boolean;
        filterable?: boolean;
        createable?: boolean;
        updateable?: boolean;
        nillable?: boolean;
        calculated?: boolean;
        defaultedOnCreate?: boolean;
        custom?: boolean;
        referenceTo?: string[];
        controllerName?: string;
        picklistValues?: Array<{ value: string; active: boolean; validFor?: string }>;
      }>;
    };
  }>> {
    return this.run(['sobject', 'describe', '--sobject', sobject, '--target-org', alias], { json: true });
  }

  async getOrgDisplay(alias: string): Promise<SfCommandResult<{ result: { instanceUrl: string; username: string; orgId: string } }>> {
    return this.displayOrg(alias) as Promise<SfCommandResult<{ result: { instanceUrl: string; username: string; orgId: string } }>>;
  }

  /** Org limits (e.g. DailyBulkApiBatches, DailyBulkV2QueryJobs) for pre-flight quota checks. */
  async listOrgLimits(
    alias: string,
  ): Promise<SfCommandResult<{ result: Array<{ name: string; max: number; remaining: number }> }>> {
    return this.run(['org', 'list', 'limits', '--target-org', alias], { json: true });
  }

  deployManifestCancellable(
    targetOrg: string,
    manifestPath: string,
    testLevel = 'NoTestRun',
    options?: DeployStartOptions,
  ): { promise: Promise<SfCommandResult>; kill: () => void } {
    const waitMin = Number(process.env.SF_DEPLOY_WAIT_MINUTES ?? 45);
    const args = [
      'project', 'deploy', 'start',
      '--manifest', manifestPath,
      '--target-org', targetOrg,
      '--test-level', testLevel,
      '--wait', String(waitMin),
    ];
    if (testLevel === 'RunSpecifiedTests' && options?.tests?.length) {
      for (const test of options.tests) {
        args.push('--tests', test);
      }
    }
    if (options?.dryRun) args.push('--dry-run');
    if (options?.postDestructiveChanges) {
      args.push('--post-destructive-changes', options.postDestructiveChanges);
    }
    return this.runStreamingCancellable(args, undefined, {
      json: true,
      cwd: options?.cwd,
      timeoutMs: waitMinutesToTimeoutMs(waitMin),
    });
  }

  /** Validate-only deploy (`--dry-run`); the returned deploy id can be used for quick deploy. */
  validateManifestCancellable(
    targetOrg: string,
    manifestPath: string,
    testLevel = 'NoTestRun',
    options?: DeployStartOptions,
  ): { promise: Promise<SfCommandResult>; kill: () => void } {
    return this.deployManifestCancellable(targetOrg, manifestPath, testLevel, {
      ...options,
      dryRun: true,
    });
  }

  /** Quick deploy a previously validated deploy request. */
  quickDeployCancellable(
    targetOrg: string,
    validationJobId: string,
    options?: { cwd?: string },
  ): { promise: Promise<SfCommandResult>; kill: () => void } {
    const waitMin = Number(process.env.SF_DEPLOY_WAIT_MINUTES ?? 45);
    return this.runStreamingCancellable([
      'project', 'deploy', 'quick',
      '--job-id', validationJobId,
      '--target-org', targetOrg,
      '--wait', String(waitMin),
    ], undefined, {
      json: true,
      cwd: options?.cwd,
      timeoutMs: waitMinutesToTimeoutMs(waitMin),
    });
  }

  deployManifestBatchCancellable(
    targetOrg: string,
    manifestPath: string,
    testLevel = 'NoTestRun',
  ): { promise: Promise<SfCommandResult>; kill: () => void } {
    return this.deployManifestCancellable(targetOrg, manifestPath, testLevel);
  }

  async retrieveMetadataMember(
    sourceOrg: string,
    metadataType: string,
    fullName: string,
    projectDir: string,
    waitMinutes = 10,
  ): Promise<SfCommandResult> {
    const member = `${metadataType}:${fullName}`;
    return this.runStreaming([
      'project', 'retrieve', 'start',
      '-m', member,
      '--target-org', sourceOrg,
      '--wait', String(waitMinutes),
    ], undefined, { json: true, cwd: projectDir });
  }

  async retrieveManifest(
    sourceOrg: string,
    manifestPath: string,
    outputDir?: string,
    waitMinutes = 30,
  ): Promise<SfCommandResult> {
    const args = [
      'project', 'retrieve', 'start',
      '--manifest', manifestPath,
      '--target-org', sourceOrg,
      '--wait', String(waitMinutes),
    ];
    if (outputDir) {
      args.push('--output-dir', outputDir);
    }
    return this.runStreaming(args, undefined, {
      json: true,
      timeoutMs: waitMinutesToTimeoutMs(waitMinutes),
    });
  }

  parseDeployJson(stdoutOrData: unknown): {
    success: boolean;
    id?: string;
    componentFailures?: Array<{ componentType?: string; fullName?: string; problem?: string }>;
    numberComponentsDeployed?: number;
    numberComponentErrors?: number;
  } {
    let data: unknown = stdoutOrData;
    if (typeof stdoutOrData === 'string') {
      try {
        const start = stdoutOrData.indexOf('{');
        if (start >= 0) data = JSON.parse(stdoutOrData.slice(start));
      } catch {
        return { success: false };
      }
    }
    if (!data || typeof data !== 'object') return { success: false };
    const obj = data as Record<string, unknown>;
    const result = (obj.result ?? obj) as Record<string, unknown>;
    const details = result.details as Record<string, unknown> | undefined;
    const failures = (details?.componentFailures ?? result.componentFailures) as
      | Array<{ componentType?: string; fullName?: string; problem?: string }>
      | undefined;
    const success =
      result.success === true ||
      result.status === 'Succeeded' ||
      (result.numberComponentErrors === 0 && result.numberComponentsDeployed !== undefined);
    return {
      success: Boolean(success),
      id: typeof result.id === 'string' ? result.id : undefined,
      componentFailures: failures,
      numberComponentsDeployed: Number(result.numberComponentsDeployed ?? 0),
      numberComponentErrors: Number(result.numberComponentErrors ?? 0),
    };
  }
}

export function sfdmuPluginInstallMessage(
  version = process.env.SFDMU_PLUGIN_VERSION?.trim() || '5.8.0',
): string {
  return 'SFDMU plugin is unavailable. Automatic provisioning was attempted; '
    + `verify Salesforce CLI access or run "sf plugins install sfdmu@${version}" on the API host`;
}

export const SFDMU_PLUGIN_INSTALL_MESSAGE = sfdmuPluginInstallMessage();

export function isSfdmuPluginMissingError(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('not a sf command')
    || lower.includes('sfdmu run is not')
    || lower.includes('command sfdmu')
    || lower.includes('plugin is unavailable');
}

export function createSfCliClient(options?: SfCliOptions): SfCliClient {
  return new SfCliClient(options);
}

export function extractPasswordFromCliResult(result: SfCommandResult): string | undefined {
  const fromData = extractPasswordFromPayload(result.data);
  if (fromData) return fromData;
  return extractPasswordFromPayload(parseCliJson(result.stdout));
}

function parseCliJson(text: string): unknown {
  try {
    const trimmed = text.trim();
    const start = trimmed.indexOf('{');
    if (start < 0) return undefined;
    return JSON.parse(trimmed.slice(start)) as unknown;
  } catch {
    return undefined;
  }
}

function extractPasswordFromPayload(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  const result = obj.result as Record<string, unknown> | undefined;
  if (typeof result?.password === 'string' && result.password) return result.password;
  if (typeof obj.password === 'string' && obj.password) return obj.password;
  return undefined;
}