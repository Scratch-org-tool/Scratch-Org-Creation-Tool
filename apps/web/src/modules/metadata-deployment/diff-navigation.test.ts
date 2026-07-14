import assert from 'node:assert/strict';
import { buildDiffHunks, extractHunkContent } from './diff-navigation';

const diffLines = [
  { value: 'line1\n' },
  { value: 'removed\n', removed: true },
  { value: 'added\n', added: true },
  { value: 'line4\n' },
  { value: 'only add\n', added: true },
];

const hunks = buildDiffHunks(diffLines);

assert.equal(hunks.length, 2);
assert.equal(hunks[0].chunkIndices.length, 2);
assert.equal(hunks[0].hasRemoved, true);
assert.equal(hunks[0].hasAdded, true);
assert.equal(hunks[1].chunkIndices[0], 4);
assert.equal(hunks[1].hasAdded, true);
assert.equal(hunks[1].hasRemoved, false);

const modify = extractHunkContent(diffLines, hunks[0]);
assert.equal(modify.kind, 'modify');
assert.equal(modify.sourceText, 'added\n');
assert.equal(modify.targetText, 'removed\n');

const addOnly = extractHunkContent(diffLines, hunks[1]);
assert.equal(addOnly.kind, 'add');
assert.equal(addOnly.sourceText, 'only add\n');
assert.equal(addOnly.targetText, '');

const removeOnly = extractHunkContent(
  [{ value: 'gone\n', removed: true }],
  buildDiffHunks([{ value: 'gone\n', removed: true }])[0],
);
assert.equal(removeOnly.kind, 'remove');
assert.equal(removeOnly.sourceText, '');
assert.equal(removeOnly.targetText, 'gone\n');

console.log('diff-navigation tests passed');
