import { displayAccessRole, getEffectiveModules } from '@sfcc/shared';
import type { ManageDraft, UserAccessOverview, UserAccessRow } from './types';

export function applyAccessDraft(
  overview: UserAccessOverview,
  userId: string,
  draft: ManageDraft,
): UserAccessOverview {
  const previous = overview.users.find((user) => user.id === userId);
  if (!previous) return overview;
  const updated: UserAccessRow = {
    ...previous,
    ...draft,
    effectiveModules: getEffectiveModules(draft),
    displayRole: displayAccessRole(draft),
    optimisticState: 'saving',
  };
  return {
    stats: {
      ...overview.stats,
      active: overview.stats.active
        + Number(previous.status !== 'active' && draft.status === 'active')
        - Number(previous.status === 'active' && draft.status !== 'active'),
      inactive: overview.stats.inactive
        + Number(previous.status !== 'inactive' && draft.status === 'inactive')
        - Number(previous.status === 'inactive' && draft.status !== 'inactive'),
      admins: overview.stats.admins
        + Number(previous.role !== 'admin' && draft.role === 'admin')
        - Number(previous.role === 'admin' && draft.role !== 'admin'),
    },
    users: overview.users.map((user) => user.id === userId ? updated : user),
  };
}

export function reconcileAccessRow(
  overview: UserAccessOverview,
  updated: UserAccessRow,
): UserAccessOverview {
  return {
    ...overview,
    users: overview.users.map((user) => user.id === updated.id ? updated : user),
  };
}
