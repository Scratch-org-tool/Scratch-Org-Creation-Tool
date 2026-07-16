import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDriftItems,
  classifyDriftPair,
  diffDriftSnapshots,
  driftMonitorCreateSchema,
  driftStatusFromSummary,
  summarizeDrift,
  type DriftItem,
} from './drift';

describe('classifyDriftPair', () => {
  it('flags presence differences', () => {
    assert.equal(classifyDriftPair({ fullName: 'A' }, undefined), 'new');
    assert.equal(classifyDriftPair(undefined, { fullName: 'A' }), 'deleted');
  });

  it('uses lastModifiedDate to detect changes for both-present items', () => {
    assert.equal(
      classifyDriftPair(
        { fullName: 'A', lastModifiedDate: '2026-01-02T00:00:00Z' },
        { fullName: 'A', lastModifiedDate: '2026-01-01T00:00:00Z' },
      ),
      'changed',
    );
    assert.equal(
      classifyDriftPair(
        { fullName: 'A', lastModifiedDate: '2026-01-01T00:00:00Z' },
        { fullName: 'A', lastModifiedDate: '2026-01-01T00:00:00Z' },
      ),
      'same',
    );
  });

  it('treats missing modified dates as unchanged (no false positives)', () => {
    assert.equal(classifyDriftPair({ fullName: 'A' }, { fullName: 'A' }), 'same');
  });
});

describe('buildDriftItems + summarizeDrift', () => {
  it('returns only differing items and summarizes them', () => {
    const items = buildDriftItems(
      'ApexClass',
      [
        { fullName: 'OnlySource' },
        { fullName: 'Changed', lastModifiedDate: '2026-01-02T00:00:00Z' },
        { fullName: 'Same', lastModifiedDate: '2026-01-01T00:00:00Z' },
      ],
      [
        { fullName: 'OnlyTarget' },
        { fullName: 'Changed', lastModifiedDate: '2026-01-01T00:00:00Z' },
        { fullName: 'Same', lastModifiedDate: '2026-01-01T00:00:00Z' },
      ],
    );
    // OnlySource (new), OnlyTarget (deleted), Changed (changed). Same is dropped.
    assert.equal(items.length, 3);
    const summary = summarizeDrift(items);
    assert.equal(summary.totalDifferences, 3);
    assert.equal(summary.added, 1);
    assert.equal(summary.removed, 1);
    assert.equal(summary.changed, 1);
    assert.equal(summary.byType.ApexClass?.total, 3);
  });
});

describe('driftStatusFromSummary', () => {
  it('is clean with zero differences and drifted otherwise', () => {
    assert.equal(driftStatusFromSummary(summarizeDrift([])), 'clean');
    assert.equal(
      driftStatusFromSummary(
        summarizeDrift([{ metadataType: 'ApexClass', fullName: 'A', diffType: 'new' }]),
      ),
      'drifted',
    );
  });
});

describe('diffDriftSnapshots', () => {
  const base: DriftItem = { metadataType: 'ApexClass', fullName: 'A', diffType: 'new' };

  it('detects newly drifted items', () => {
    const delta = diffDriftSnapshots([], [base]);
    assert.equal(delta.newlyDrifted.length, 1);
    assert.equal(delta.resolved.length, 0);
  });

  it('detects reconciled items', () => {
    const delta = diffDriftSnapshots([base], []);
    assert.equal(delta.newlyDrifted.length, 0);
    assert.equal(delta.resolved.length, 1);
  });

  it('treats a fresh edit to an already-changed item as newly drifted', () => {
    const previous: DriftItem = {
      metadataType: 'ApexClass',
      fullName: 'A',
      diffType: 'changed',
      sourceModified: '2026-01-02T00:00:00Z',
      targetModified: '2026-01-01T00:00:00Z',
    };
    const current: DriftItem = {
      ...previous,
      sourceModified: '2026-01-03T00:00:00Z',
    };
    const delta = diffDriftSnapshots([previous], [current]);
    assert.equal(delta.newlyDrifted.length, 1);
  });
});

describe('driftMonitorCreateSchema', () => {
  const sourceOrgId = '11111111-1111-1111-1111-111111111111';
  const targetOrgId = '22222222-2222-2222-2222-222222222222';

  it('rejects identical source and target orgs', () => {
    assert.equal(
      driftMonitorCreateSchema.safeParse({
        name: 'Prod vs UAT',
        sourceOrgId,
        targetOrgId: sourceOrgId,
      }).success,
      false,
    );
  });

  it('requires a schedule when automatic checks are enabled', () => {
    assert.equal(
      driftMonitorCreateSchema.safeParse({
        name: 'Prod vs UAT',
        sourceOrgId,
        targetOrgId,
        scheduleEnabled: true,
      }).success,
      false,
    );
  });

  it('accepts a valid monitor and de-duplicates metadata types', () => {
    const result = driftMonitorCreateSchema.safeParse({
      name: 'Prod vs UAT',
      sourceOrgId,
      targetOrgId,
      metadataTypes: ['Flow', 'ApexClass', 'Flow'],
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(result.data.metadataTypes, ['ApexClass', 'Flow']);
    }
  });
});
