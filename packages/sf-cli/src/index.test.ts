import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatRecordValues, SfCliClient, type StreamLine } from './index';

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
