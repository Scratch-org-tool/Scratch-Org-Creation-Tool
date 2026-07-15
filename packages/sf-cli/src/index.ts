import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'node:path';

const DEFAULT_STREAM_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const TERMINATION_GRACE_MS = 5000;

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
  alias?: string;
  username?: string;
  orgId?: string;
  instanceUrl?: string;
  isDevHub?: boolean;
  connectedStatus?: string;
  expirationDate?: string;
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

function configuredStreamTimeout(timeoutMs?: number): number {
  if (timeoutMs !== undefined && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }
  const configured = Number(process.env.SF_STREAM_TIMEOUT_MS ?? DEFAULT_STREAM_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STREAM_TIMEOUT_MS;
}

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
        shell: process.platform === 'win32',
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
        shell: process.platform === 'win32',
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

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk: Buffer) => {
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
  async installPackage(packageId: string, targetOrg: string, waitMinutes = 30): Promise<SfCommandResult> {
    return this.runStreaming([
      'package', 'install',
      '--package', packageId,
      '--target-org', targetOrg,
      '--wait', String(waitMinutes),
      '--no-prompt',
    ]);
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
    return this.run(['data', 'query', '--query', soql, '--target-org', alias], { json: true });
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
      '--query', query,
      '--target-org', targetOrg,
      '--output-file', outputFile,
      '--result-format', 'csv',
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
    return this.runStreaming([
      'data', 'import', 'bulk',
      '--sobject', sobject,
      '--file', file,
      '--target-org', targetOrg,
      '--wait', String(waitMinutes),
      '--line-ending', 'LF',
    ], undefined, {
      cwd: options?.cwd,
      onSpawn: options?.onSpawn,
      timeoutMs: waitMinutesToTimeoutMs(waitMinutes),
    });
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

  // SFDMU
  async isSfdmuPluginInstalled(): Promise<boolean> {
    const result = await this.run(['plugins', 'inspect', 'sfdmu']);
    return result.success;
  }

  async ensureSfdmuPlugin(): Promise<void> {
    if (!(await this.isSfdmuPluginInstalled())) {
      throw new SfCliError(SFDMU_PLUGIN_INSTALL_MESSAGE, 1, '');
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
    return this.runStreaming([
      'sfdmu', 'run',
      '--sourceusername', sourceAlias,
      '--targetusername', targetAlias,
      '--path', path,
    ], onLine, {
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
    return this.runStreaming([
      'data', 'upsert', 'bulk',
      '-f', file,
      '-s', sobject,
      '-i', externalId,
      '--target-org', targetOrg,
      '--wait', String(waitMinutes),
      '--line-ending', 'CRLF',
    ], undefined, {
      cwd: options?.cwd,
      onSpawn: options?.onSpawn,
      timeoutMs: waitMinutesToTimeoutMs(waitMinutes),
    });
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
        filterable?: boolean;
        createable?: boolean;
        updateable?: boolean;
        nillable?: boolean;
        calculated?: boolean;
        defaultedOnCreate?: boolean;
        custom?: boolean;
        referenceTo?: string[];
        picklistValues?: Array<{ value: string; active: boolean }>;
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

export const SFDMU_PLUGIN_INSTALL_MESSAGE =
  'SFDMU plugin not installed. Run: sf plugins install sfdmu';

export function isSfdmuPluginMissingError(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('not a sf command') || lower.includes('sfdmu run is not');
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