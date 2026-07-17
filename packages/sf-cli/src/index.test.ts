import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatRecordValues,
  parseSfPluginVersion,
  requiredSfPlugins,
  SfCliClient,
  type StreamLine,
} from './index';

describe('SfCliClient streaming', () => {
  it('preserves logical lines split across output chunks', async () => {
    const client = new SfCliClient({ cliPath: process.execPath });
    const lines: StreamLine[] = [];
    const script = [
      "process.stdout.write('hel')",
      "setTimeout(() => process.stdout.write('lo\\nwor'), 10)",
      "setTimeout(() => process.stdout.write('ld'), 20)",
    ].join(';');

    const result = await client.runStreaming(
      ['-e', script],
      (line) => lines.push(line),
      { timeoutMs: 2_000 },
    );

    assert.equal(result.success, true);
    assert.deepEqual(lines.map((line) => line.line), ['hello', 'world']);
  });

  it('runs SFDMU non-interactively and fails on warnings by default', async () => {
    const client = new SfCliClient({ env: { SFDMU_FAIL_ON_WARNING: 'true' } });
    let received: string[] = [];
    client.runStreaming = async (args) => {
      received = args;
      return { success: true, stdout: '', stderr: '', exitCode: 0 };
    };

    await client.runSfdmu('source-org', 'target-org', '/tmp/sfdmu-run');

    assert.deepEqual(received, [
      'sfdmu', 'run',
      '--sourceusername', 'source-org',
      '--targetusername', 'target-org',
      '--path', '/tmp/sfdmu-run',
      '--noprompt',
      '--failonwarning',
    ]);
  });

  it('keeps CLI update notices out of actionable command errors', async () => {
    const client = new SfCliClient({ cliPath: process.execPath });
    const script = [
      "process.stderr.write('Warning: @salesforce/cli update available from 2.130.9 to 2.142.7.\\n')",
      "process.stderr.write('Error (1): Selecting compound data not supported in Bulk Query\\n')",
      'process.exitCode = 1',
    ].join(';');

    const result = await client.runStreaming(['-e', script], undefined, {
      timeoutMs: 2_000,
    });

    assert.equal(result.success, false);
    assert.equal(
      result.error,
      'Error (1): Selecting compound data not supported in Bulk Query',
    );
    assert.match(result.stderr, /update available/);
  });
});

describe('formatRecordValues', () => {
  it('quotes and escapes values parsed by the Salesforce CLI', () => {
    assert.equal(
      formatRecordValues({
        Name: "O'Brien & Sons",
        Empty: '',
        Path: 'C:\\Temp',
        Plain: 'Acme',
      }),
      "Name='O\\'Brien & Sons' Empty='' Path='C:\\\\Temp' Plain=Acme",
    );
  });
});

describe('Salesforce bulk CSV line endings', () => {
  it('normalizes CSV bytes to LF before bulk import and upsert', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sfcc-bulk-csv-'));
    writeFileSync(join(root, 'import.csv'), 'Name,Value\r\nA,1\r\n');
    writeFileSync(join(root, 'upsert.csv'), 'Name,ExternalId\nA,1\n');
    writeFileSync(join(root, 'bom.csv'), '\uFEFFName,Value\r\nB,2\r\n');
    const client = new SfCliClient({ cwd: root });
    const received: Array<{ args: string[]; content: string; file: string }> = [];
    client.runStreaming = async (args) => {
      const fileFlag = args.includes('--file') ? '--file' : '-f';
      const normalizedFile = args[args.indexOf(fileFlag) + 1];
      received.push({
        args,
        content: readFileSync(normalizedFile, 'utf8'),
        file: normalizedFile,
      });
      return { success: true, stdout: '', stderr: '', exitCode: 0 };
    };

    try {
      await client.importBulk('Example__c', 'import.csv', 'target');
      await client.upsertBulk('Example__c', 'upsert.csv', 'ExternalId', 'target');
      await client.importBulk('Example__c', 'bom.csv', 'target');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    assert.deepEqual(
      received.map(({ args }) =>
        args.slice(args.indexOf('--line-ending'), args.indexOf('--line-ending') + 2)),
      [
        ['--line-ending', 'LF'],
        ['--line-ending', 'LF'],
        ['--line-ending', 'LF'],
      ],
    );
    assert.deepEqual(
      received.map(({ content }) => content),
      ['Name,Value\nA,1\n', 'Name,ExternalId\nA,1\n', 'Name,Value\nB,2\n'],
    );
    assert.equal(received.every(({ file }) => !existsSync(file)), true);
  });
});

describe('required Salesforce CLI plugins', () => {
  it('contains only the explicit application allowlist with pinned defaults', () => {
    assert.deepEqual(
      requiredSfPlugins({}).map(({ id, version }) => ({ id, version })),
      [
        { id: 'sfdmu', version: '5.8.0' },
        { id: 'code-analyzer', version: '5.14.0' },
      ],
    );
  });

  it('supports operator-controlled version pins without accepting extra plugins', () => {
    const plugins = requiredSfPlugins({
      SFDMU_PLUGIN_VERSION: '4.39.0',
      SF_CODE_ANALYZER_PLUGIN_VERSION: '5.12.0',
    });
    assert.equal(plugins.length, 2);
    assert.equal(plugins[0]?.version, '4.39.0');
    assert.equal(plugins[1]?.version, '5.12.0');
  });

  it('parses versions from Salesforce plugins inspect JSON', () => {
    assert.equal(parseSfPluginVersion([{
      options: { name: 'sfdmu', tag: '5.8.0' },
      version: '5.8.0',
    }]), '5.8.0');
    assert.equal(parseSfPluginVersion({ version: '5.14.0' }), '5.14.0');
    assert.equal(parseSfPluginVersion({ message: 'missing' }), undefined);
  });

  it('installs, verifies, and then reuses every missing allowlisted plugin', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sfcc-fake-sf-'));
    const statePath = join(root, 'state.json');
    const scriptPath = join(root, 'fake-sf.js');
    writeFileSync(scriptPath, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const statePath = process.env.FAKE_SF_STATE;
const read = () => fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
if (args[0] === '--version') {
  console.log('@salesforce/cli/2.143.6 fake');
  process.exit(0);
}
if (args[0] === 'plugins' && args[1] === 'inspect') {
  const state = read();
  const version = state[args[2]];
  if (!version) {
    console.error('Plugin not installed: ' + args[2]);
    process.exit(1);
  }
  console.log(JSON.stringify([{ options: { name: args[2], tag: version }, version }]));
  process.exit(0);
}
if (args[0] === 'plugins' && args[1] === 'install') {
  const split = args[2].lastIndexOf('@');
  const name = args[2].slice(0, split);
  const version = args[2].slice(split + 1);
  const state = read();
  state[name] = version;
  fs.writeFileSync(statePath, JSON.stringify(state));
  console.log('installed ' + args[2]);
  process.exit(0);
}
console.error('unexpected args: ' + JSON.stringify(args));
process.exit(2);
`);
    let cliPath = scriptPath;
    if (process.platform === 'win32') {
      cliPath = join(root, 'fake-sf.cmd');
      writeFileSync(cliPath, `@echo off\r\n"${process.execPath}" "${scriptPath}" %*\r\n`);
    } else {
      chmodSync(scriptPath, 0o755);
    }

    try {
      const client = new SfCliClient({
        cliPath,
        env: {
          FAKE_SF_STATE: statePath,
          SF_PLUGIN_CONFIG_DIR: join(root, 'config'),
          SF_AUTO_INSTALL_PLUGINS: 'true',
          SF_ENFORCE_PLUGIN_VERSIONS: 'true',
          SFDMU_PLUGIN_VERSION: '5.8.0',
          SF_CODE_ANALYZER_PLUGIN_VERSION: '5.14.0',
        },
      });
      const installed = await client.getRequiredPluginsReadiness();
      assert.equal(installed.ready, true);
      assert.deepEqual(installed.plugins.map((plugin) => plugin.action), ['installed', 'installed']);
      assert.deepEqual(JSON.parse(readFileSync(statePath, 'utf8')), {
        sfdmu: '5.8.0',
        'code-analyzer': '5.14.0',
      });

      const reused = await client.getRequiredPluginsReadiness();
      assert.equal(reused.ready, true);
      assert.deepEqual(reused.plugins.map((plugin) => plugin.action), ['none', 'none']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
