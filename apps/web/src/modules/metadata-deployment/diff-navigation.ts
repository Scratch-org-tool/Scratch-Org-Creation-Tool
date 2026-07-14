export type DiffLine = { value: string; added?: boolean; removed?: boolean };

export interface DiffHunk {
  id: number;
  chunkIndices: number[];
  hasAdded: boolean;
  hasRemoved: boolean;
}

export type HunkContentKind = 'modify' | 'add' | 'remove';

export interface HunkContent {
  sourceText: string;
  targetText: string;
  kind: HunkContentKind;
}

export function buildDiffHunks(diffLines: DiffLine[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];

  for (let i = 0; i < diffLines.length; i++) {
    const part = diffLines[i];
    if (!part.added && !part.removed) continue;

    const last = hunks[hunks.length - 1];
    const lastChunk = last?.chunkIndices[last.chunkIndices.length - 1];
    const isAdjacent = last !== undefined && lastChunk !== undefined && i <= lastChunk + 1;

    if (isAdjacent) {
      last.chunkIndices.push(i);
      last.hasAdded = last.hasAdded || !!part.added;
      last.hasRemoved = last.hasRemoved || !!part.removed;
    } else {
      hunks.push({
        id: hunks.length,
        chunkIndices: [i],
        hasAdded: !!part.added,
        hasRemoved: !!part.removed,
      });
    }
  }

  return hunks;
}

export function extractHunkContent(diffLines: DiffLine[], hunk: DiffHunk): HunkContent {
  let sourceText = '';
  let targetText = '';

  for (const index of hunk.chunkIndices) {
    const part = diffLines[index];
    if (!part) continue;
    if (part.added) sourceText += part.value;
    if (part.removed) targetText += part.value;
  }

  const hasSource = sourceText.length > 0;
  const hasTarget = targetText.length > 0;
  let kind: HunkContentKind = 'modify';
  if (hasSource && !hasTarget) kind = 'add';
  else if (!hasSource && hasTarget) kind = 'remove';

  return { sourceText, targetText, kind };
}

export function hunkElementId(side: 'source' | 'target', chunkIndex: number): string {
  return `diff-hunk-${side}-${chunkIndex}`;
}

export function scrollToHunk(hunk: DiffHunk): void {
  const targets: string[] = [];
  const firstChunk = hunk.chunkIndices[0];

  if (hunk.hasAdded) {
    targets.push(hunkElementId('source', firstChunk));
  }
  if (hunk.hasRemoved) {
    targets.push(hunkElementId('target', firstChunk));
  }

  for (const id of targets) {
    document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
