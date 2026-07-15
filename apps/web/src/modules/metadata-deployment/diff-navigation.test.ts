import assert from 'node:assert/strict';
import { buildDiffHunks, extractHunkContent, getDiffWindowRange } from './diff-navigation';

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

assert.equal(getDiffWindowRange(800, [400]), null);
assert.deepEqual(getDiffWindowRange(2_000, []), { start: 0, end: 800 });
assert.deepEqual(getDiffWindowRange(2_000, [900, 901]), { start: 750, end: 1052 });
assert.deepEqual(getDiffWindowRange(2_000, [20]), { start: 0, end: 171 });
assert.deepEqual(getDiffWindowRange(2_000, [1_950]), { start: 1_800, end: 2_000 });
assert.deepEqual(getDiffWindowRange(5_000, [1_000, 3_000]), { start: 850, end: 1_650 });

console.log('diff-navigation tests passed');
