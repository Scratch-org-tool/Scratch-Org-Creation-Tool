import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
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
