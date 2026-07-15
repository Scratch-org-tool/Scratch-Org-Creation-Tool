import type {
  ExistingScratchOrgCandidate,
  RecentScratchOrgRun,
} from './types';

interface ScratchOrgRow {
  id: string;
  alias: string;
  username?: string | null;
  orgId?: string | null;
  status: string;
  expirationDate?: string | null;
  devHubAlias?: string | null;
}

interface OrgConnectionRow {
  id: string;
  alias: string;
  username?: string | null;
  orgId?: string | null;
  type?: string;
  status?: string;
  expiresAt?: string | null;
}

const ACTIVE_RUN_STATUSES = new Set(['pending', 'queued', 'planning', 'running', 'paused']);

export function buildExistingScratchOrgCandidates(
  scratchOrgs: ScratchOrgRow[],
  orgConnections: OrgConnectionRow[],
  recentRuns: RecentScratchOrgRun[],
  now = Date.now(),
): ExistingScratchOrgCandidate[] {
  const connectionsByAlias = new Map(
    orgConnections
      .filter((org) => org.type === 'scratch')
      .map((org) => [org.alias, org]),
  );

  return scratchOrgs.flatMap((scratch) => {
    const connection = connectionsByAlias.get(scratch.alias);
    if (!connection) return [];
    const expirationDate = connection.expiresAt ?? scratch.expirationDate;
    const expired = expirationDate ? Date.parse(expirationDate) <= now : false;
    const latestRun = recentRuns.find((run) =>
      run.targetOrgConnectionId === connection.id
      || run.targetOrgConnection?.id === connection.id);
    return [{
      id: scratch.id,
      orgConnectionId: connection.id,
      alias: scratch.alias,
      username: connection.username ?? scratch.username,
      orgId: connection.orgId ?? scratch.orgId,
      status: expired ? 'expired' : (connection.status ?? scratch.status),
      expirationDate,
      devHubAlias: scratch.devHubAlias,
      authenticated: connection.status === 'active',
      latestRun,
    }];
  });
}

export function isCandidateSelectable(candidate: ExistingScratchOrgCandidate): boolean {
  return candidate.status.toLowerCase() === 'active' && candidate.authenticated;
}

export function isActiveRecentRun(run?: RecentScratchOrgRun): boolean {
  return Boolean(run && ACTIVE_RUN_STATUSES.has(run.status));
}

export function packageEligibilitySummary(
  ensureRequiredPackage: boolean,
  messages: string[] = [],
): string {
  if (!ensureRequiredPackage) return 'Skip package verification and installation';
  if (messages.some((message) => /already installed/i.test(message))) {
    return 'Verify required package (already installed; no install)';
  }
  if (messages.some((message) => /will be installed/i.test(message))) {
    return 'Verify and install required package if missing';
  }
  return 'Verify required package and install if missing';
}
