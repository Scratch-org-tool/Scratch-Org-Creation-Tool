import { describe, expect, it } from 'vitest';
import {
  applyEntityState,
  restoreDefaultFlags,
  setExclusiveDefault,
} from './optimistic-domain';
import {
  appendMissingById,
  EntityRequestGate,
  insertAfterId,
  MutationAwareRequestGate,
  removeAtId,
  replaceOrAppendAtId,
  replaceOrInsertAfterId,
  replaceAtId,
  restoreAtIndex,
  withoutIds,
} from './optimistic-list';
import {
  applyApprovalPending,
  reconcileApproval,
  reconcileApprovalFailure,
  rollbackApproval,
} from '../modules/deployment-center/optimistic-deployments';
import {
  applyAccessDraft,
  reconcileAccessRow,
} from '../modules/admin/user-access/optimistic-user-access';
import type {
  ManageDraft,
  UserAccessOverview,
  UserAccessRow,
} from '../modules/admin/user-access/types';

describe('defects optimistic mutations', () => {
  it('updates status immediately, reconciles the server row, and rolls back both snapshots', () => {
    const rows = [
      { id: 'D-1', state: { name: 'Open', color: 'blue' }, title: 'First' },
      { id: 'D-2', state: { name: 'Open', color: 'blue' }, title: 'Second' },
    ];
    const detail = rows[0]!;
    const pendingRows = applyEntityState(rows, 'D-1', 'Resolved');
    const pendingDetail = applyEntityState([detail], 'D-1', 'Resolved')[0]!;
    expect(pendingRows[0]?.state.name).toBe('Resolved');
    expect(pendingDetail.state.name).toBe('Resolved');

    const server = { ...detail, state: { name: 'Done', color: 'green' }, title: 'Server title' };
    expect(replaceAtId(pendingRows, 'D-1', server)[0]).toEqual(server);
    expect(replaceAtId(pendingRows, 'D-1', detail)[0]).toEqual(detail);
  });

  it('reconciles a pending comment and restores an attachment at its original index on failure', () => {
    const comments = [{ id: 'c1', body: 'Existing' }];
    const pending = { id: 'temp-c2', body: 'Draft', optimisticState: 'pending' };
    const withPending = [...comments, pending];
    expect(pending.optimisticState).toBe('pending');
    expect(replaceAtId(withPending, pending.id, { id: 'c2', body: 'Server body' }).at(-1))
      .toEqual({ id: 'c2', body: 'Server body' });
    expect(removeAtId(withPending, pending.id).items).toEqual(comments);

    const attachments = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const removed = removeAtId(attachments, 'b');
    expect(removed.items).toEqual([{ id: 'a' }, { id: 'c' }]);
    expect(restoreAtIndex(removed.items, removed.snapshot)).toEqual(attachments);
  });

  it('overlays pending operations on refresh and reconciles success when the temp row was dropped', () => {
    type CommentRow = { id: string; body: string; optimisticState?: string };
    const pending: CommentRow = { id: 'temp-c2', body: 'Draft', optimisticState: 'pending' };
    expect(appendMissingById<CommentRow>([{ id: 'c1', body: 'Existing' }], [pending]))
      .toEqual([{ id: 'c1', body: 'Existing' }, pending]);

    const server = { id: 'c2', body: 'Saved' };
    expect(replaceOrAppendAtId([{ id: 'c1', body: 'Existing' }], pending.id, server))
      .toEqual([{ id: 'c1', body: 'Existing' }, server]);
    expect(replaceOrAppendAtId([{ id: 'c1', body: 'Existing' }, server], pending.id, server))
      .toEqual([{ id: 'c1', body: 'Existing' }, server]);

    const resurrected = [{ id: 'a' }, { id: 'deleted' }, { id: 'b' }];
    expect(withoutIds(resurrected, new Set(['deleted']))).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});

describe('default Dev Hub optimistic mutation', () => {
  it('flips the star exclusively, reconciles response data, and supports snapshot rollback', () => {
    const orgs: Array<{
      id: string;
      alias: string;
      isDefaultDevHub: boolean;
      status?: string;
    }> = [
      { id: '1', alias: 'hub-a', isDefaultDevHub: true },
      { id: '2', alias: 'hub-b', isDefaultDevHub: false },
    ];
    const pending = setExclusiveDefault(orgs, 'hub-b');
    expect(pending.map((org) => org.isDefaultDevHub)).toEqual([false, true]);
    const reconciled = replaceAtId(pending, '2', { ...pending[1]!, status: 'Connected' });
    expect(reconciled[1]?.status).toBe('Connected');
    expect(orgs.map((org) => org.isDefaultDevHub)).toEqual([true, false]);
  });

  it('rolls back only flags on rows that are still connected', () => {
    const snapshot = [
      { alias: 'removed', isDefaultDevHub: true },
      { alias: 'remaining', isDefaultDevHub: false },
    ];
    const current = [
      { alias: 'remaining', isDefaultDevHub: true, status: 'Connected' },
      { alias: 'new', isDefaultDevHub: false, status: 'Connected' },
    ];
    expect(restoreDefaultFlags(current, snapshot)).toEqual([
      { alias: 'remaining', isDefaultDevHub: false, status: 'Connected' },
      { alias: 'new', isDefaultDevHub: false, status: 'Connected' },
    ]);
  });
});

describe('scratch-template optimistic mutations', () => {
  it('inserts and reconciles a provisional duplicate and restores a failed delete index', () => {
    const templates = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }];
    const provisional = { id: 'temp', name: 'One (copy)', optimisticState: 'duplicating' };
    const pending = insertAfterId(templates, 'one', provisional);
    expect(pending.map((item) => item.id)).toEqual(['one', 'temp', 'two']);
    expect(replaceAtId(pending, 'temp', { id: 'copy', name: 'Server copy' })[1])
      .toEqual({ id: 'copy', name: 'Server copy' });

    const removed = removeAtId(templates, 'one');
    expect(restoreAtIndex(removed.items, removed.snapshot)).toEqual(templates);
  });

  it('reconciles duplicate success idempotently after a stale refresh dropped the provisional row', () => {
    const refreshed = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }];
    const created = { id: 'copy', name: 'Server copy' };
    const once = replaceOrInsertAfterId(refreshed, 'temp', 'one', created);
    const twice = replaceOrInsertAfterId(once, 'temp', 'one', created);
    expect(once).toEqual([
      { id: 'one', name: 'One' },
      created,
      { id: 'two', name: 'Two' },
    ]);
    expect(twice).toEqual(once);
  });

  it('rejects stale list requests across mutations', () => {
    const gate = new MutationAwareRequestGate();
    const beforeMutation = gate.beginRequest();
    gate.beginMutation();
    expect(gate.isLatest(beforeMutation)).toBe(false);
    const duringMutation = gate.beginRequest();
    gate.finishMutation();
    expect(gate.isLatest(duringMutation)).toBe(false);
    expect(gate.isLatest(gate.beginRequest())).toBe(true);
  });
});

describe('provider-binding optimistic deletion', () => {
  it('removes immediately and restores the exact original position on failure', () => {
    const bindings = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const pending = removeAtId(bindings, 'b');
    expect(pending.items.map((binding) => binding.id)).toEqual(['a', 'c']);
    expect(restoreAtIndex(pending.items, pending.snapshot)).toEqual(bindings);
  });
});

describe.each(['attachments', 'templates', 'bindings'])(
  '%s concurrent optimistic deletions',
  (collection) => {
    it('serializes the collection so rollback order cannot depend on response order', () => {
      const gate = new EntityRequestGate();
      const first = gate.begin(collection);
      expect(first).toBe(1);
      expect(gate.begin(collection)).toBeNull();
      expect(gate.finish(collection, first!)).toBe(true);
      expect(gate.begin(collection)).toBe(2);
    });
  },
);

describe('deployment approval optimistic mutation', () => {
  it('queues immediately, reconciles the server result, and rolls back failure', () => {
    const deployments = [{ id: 'dep-1', status: 'pending', repo: 'app' }];
    const pending = applyApprovalPending(deployments, 'dep-1');
    expect(pending[0]).toMatchObject({ status: 'queued', approvalPending: true });
    const server = { id: 'dep-1', status: 'running', repo: 'server-app' };
    expect(reconcileApproval(pending, 'dep-1', server)[0]).toEqual(server);
    expect(rollbackApproval(pending, deployments[0]!)[0]).toEqual(deployments[0]);
  });

  it('uses authoritative state after an error and retains queued state when reconciliation fails', () => {
    const deployments = [{ id: 'dep-1', status: 'pending', repo: 'app' }];
    const pending = applyApprovalPending(deployments, 'dep-1');
    expect(reconcileApprovalFailure(pending, 'dep-1', deployments)).toEqual({
      deployments,
      disposition: 'rolled_back',
    });
    expect(reconcileApprovalFailure(pending, 'dep-1', [
      { id: 'dep-1', status: 'running', repo: 'app' },
    ])).toMatchObject({ disposition: 'reconciled' });
    expect(reconcileApprovalFailure(pending, 'dep-1', null)).toEqual({
      deployments: pending,
      disposition: 'ambiguous',
    });
  });
});

describe('admin user-access optimistic mutation', () => {
  const user: UserAccessRow = {
    id: 'user-1',
    email: 'user@example.test',
    displayName: 'User One',
    role: 'user',
    grantedModules: [],
    effectiveModules: ['dashboard', 'environment', 'data', 'defects'],
    displayRole: 'Viewer',
    status: 'active',
    lastActiveAt: null,
  };
  const overview: UserAccessOverview = {
    users: [user],
    stats: {
      total: 1,
      active: 1,
      inactive: 0,
      admins: 0,
      pendingInvites: 0,
      newThisWeek: 0,
      totalTrendPct: null,
    },
  };

  it('applies the editable draft immediately, reconciles the server row, and preserves rollback snapshot', () => {
    const draft: ManageDraft = {
      role: 'admin',
      grantedModules: [],
      status: 'inactive',
    };
    const pending = applyAccessDraft(overview, user.id, draft);
    expect(pending.users[0]).toMatchObject({
      role: 'admin',
      status: 'inactive',
      displayRole: 'Super Admin',
      optimisticState: 'saving',
    });
    expect(pending.stats).toMatchObject({ active: 0, inactive: 1, admins: 1 });

    const server = { ...pending.users[0]!, displayName: 'Server Name', optimisticState: undefined };
    expect(reconcileAccessRow(pending, server).users[0]?.displayName).toBe('Server Name');
    expect(overview.users[0]).toEqual(user);
  });
});

describe.each([
  'defects',
  'default Dev Hub',
  'scratch templates',
  'provider bindings',
  'generic deployments',
  'Jenkins deployments',
  'admin user access',
])('%s request races', (domain) => {
  it('rejects double-clicks and stale responses per entity', () => {
    const gate = new EntityRequestGate();
    const first = gate.begin(`${domain}-1`);
    expect(first).toBe(1);
    expect(gate.begin(`${domain}-1`)).toBeNull();
    gate.invalidate(`${domain}-1`);
    const latest = gate.begin(`${domain}-1`);
    expect(latest).toBe(3);
    expect(gate.isLatest(`${domain}-1`, first!)).toBe(false);
    expect(gate.isLatest(`${domain}-1`, latest!)).toBe(true);
  });
});
