import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import {
  SafeExecFileAdapter,
  StaticAnalysisService,
  type ExecFileResult,
} from './static-analysis.service';

const roots: string[] = [];

function workspace(extension = '.cls') {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'static-analysis-test-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, `Example${extension}`), 'class Example {}');
  return root;
}

function execution(result: Partial<ExecFileResult>) {
  return {
    promise: Promise.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
      ...result,
    }),
    kill: vi.fn(),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('StaticAnalysisService', () => {
  it('detects tools and invokes sf code-analyzer with argument-safe exec-file arguments', async () => {
    const run = vi.fn()
      .mockReturnValueOnce(execution({ stdout: 'code-analyzer 5' }))
      .mockReturnValueOnce(execution({
        stdout: JSON.stringify({
          violations: [{
            ruleName: 'AvoidGlobalModifier',
            severity: 2,
            message: 'Avoid global',
            fileName: 'Example.cls',
            line: 4,
          }],
        }),
      }));
    const service = new StaticAnalysisService({ run } as unknown as SafeExecFileAdapter);
    const root = workspace();

    const result = await service.run({ projectRoot: root, engines: ['code-analyzer'] });

    expect(run).toHaveBeenLastCalledWith(
      'sf',
      ['code-analyzer', 'run', '--workspace', root, '--output-file', expect.any(String)],
      expect.objectContaining({ cwd: root }),
    );
    expect(result.issues).toEqual([
      expect.objectContaining({
        engine: 'code-analyzer',
        ruleId: 'AvoidGlobalModifier',
        severity: 'error',
        file: 'Example.cls',
        line: 4,
      }),
    ]);
  });

  it('skips optional engines when no applicable source exists', async () => {
    const run = vi.fn().mockReturnValue(execution({ stdout: 'eslint 9' }));
    const service = new StaticAnalysisService({ run } as unknown as SafeExecFileAdapter);

    const result = await service.run({
      projectRoot: workspace('.cls'),
      engines: ['eslint'],
    });

    expect(result.skippedEngines).toEqual([
      { engine: 'eslint', reason: 'No applicable source files found' },
    ]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('normalizes PMD findings and stable fingerprints', async () => {
    const payload = [{ rule: 'UnusedLocalVariable', priority: 3, description: 'Unused x', file: 'X.cls' }];
    const run = vi.fn()
      .mockReturnValueOnce(execution({ stdout: 'PMD 7' }))
      .mockReturnValueOnce(execution({ stdout: JSON.stringify(payload) }));
    const service = new StaticAnalysisService({ run } as unknown as SafeExecFileAdapter);

    const first = await service.run({ projectRoot: workspace(), engines: ['pmd'] });
    expect(first.issues[0]).toEqual(expect.objectContaining({
      severity: 'warning',
      ruleId: 'UnusedLocalVariable',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it('surfaces analyzer timeouts as normalized blocking issues', async () => {
    const run = vi.fn()
      .mockReturnValueOnce(execution({ stdout: 'code-analyzer 5' }))
      .mockReturnValueOnce(execution({ exitCode: 1, timedOut: true }));
    const service = new StaticAnalysisService({ run } as unknown as SafeExecFileAdapter);

    const result = await service.run({
      projectRoot: workspace(),
      engines: ['code-analyzer'],
      timeoutMs: 50,
    });

    expect(result.timedOut).toBe(true);
    expect(result.issues[0]).toEqual(expect.objectContaining({
      ruleId: 'ANALYZER_TIMEOUT',
      severity: 'error',
    }));
  });
});

describe('SafeExecFileAdapter', () => {
  it('executes a file without a shell', async () => {
    const adapter = new SafeExecFileAdapter();
    const result = await adapter.run(
      process.execPath,
      ['-e', 'process.stdout.write(process.argv[1])', 'literal;not-a-shell-command'],
      { timeoutMs: 5_000 },
    ).promise;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('literal;not-a-shell-command');
  });
});
