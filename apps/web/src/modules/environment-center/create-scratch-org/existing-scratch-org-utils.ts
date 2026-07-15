import type {
  ExistingScratchOrgCandidate,
  RecentScratchOrgRun,
} from './types';
import type {
  AutomationRunView,
  ScratchOrgLaunchMode,
} from '@/components/scratch-org/types';

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
    const latestRun = recentRuns
      .filter((run) =>
        run.targetOrgConnectionId === connection.id
        || run.targetOrgConnection?.id === connection.id)
      .reduce<RecentScratchOrgRun | undefined>((latest, run) => {
        if (!latest) return run;
        const latestAt = latest.createdAt ? Date.parse(latest.createdAt) : Number.NaN;
        const runAt = run.createdAt ? Date.parse(run.createdAt) : Number.NaN;
        return Number.isFinite(runAt) && (!Number.isFinite(latestAt) || runAt > latestAt)
          ? run
          : latest;
      }, undefined);
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

export function modeAliasState(
  currentMode: ScratchOrgLaunchMode,
  nextMode: ScratchOrgLaunchMode,
  currentAlias: string,
  createDraftAlias: string,
): { alias: string; createDraftAlias: string } {
  if (currentMode === 'create_new' && nextMode === 'configure_existing') {
    return { alias: currentAlias, createDraftAlias: currentAlias };
  }
  if (nextMode === 'create_new') {
    return { alias: createDraftAlias, createDraftAlias };
  }
  return { alias: currentAlias, createDraftAlias };
}

export interface PreparationProgress {
  authentication: 'Verified' | 'Skipped' | 'Verifying…' | 'Failed' | 'Paused' | 'Pending';
  requiredPackage:
    | 'Already installed'
    | 'Installed'
    | 'Skipped'
    | 'Checking / installing…'
    | 'Failed'
    | 'Paused'
    | 'Pending';
  error?: string;
}

export function resolvePreparationProgress(
  run: AutomationRunView | null,
): PreparationProgress | null {
  const job = run?.jobs?.findLast((candidate) => candidate.type === 'prepare_existing_org');
  if (!job) return null;

  const result = job.result as {
    authenticated?: boolean | null;
    packageAction?: 'already_installed' | 'installed' | 'skipped';
  } | undefined;
  const logs = job.logs?.map((log) => log.line) ?? [];
  const authenticationVerified = logs.some((line) =>
    /authentication verified/i.test(line));
  const authenticationSkipped = logs.some((line) =>
    /skipped .*authentication/i.test(line));
  const preparationFailed =
    job.status === 'failed'
    || (
      (run?.status === 'paused' || run?.status === 'failed')
      && run.failedStep === 'prepare_existing_org'
    );

  let authentication: PreparationProgress['authentication'];
  if (result?.authenticated === true || authenticationVerified) authentication = 'Verified';
  else if (result?.authenticated === null || authenticationSkipped) authentication = 'Skipped';
  else if (preparationFailed) authentication = 'Failed';
  else if (job.status === 'paused') authentication = 'Paused';
  else if (job.status === 'running') authentication = 'Verifying…';
  else authentication = 'Pending';

  let requiredPackage: PreparationProgress['requiredPackage'];
  if (result?.packageAction === 'already_installed') requiredPackage = 'Already installed';
  else if (result?.packageAction === 'installed') requiredPackage = 'Installed';
  else if (result?.packageAction === 'skipped') requiredPackage = 'Skipped';
  else if (preparationFailed) {
    requiredPackage = authenticationVerified || authenticationSkipped ? 'Failed' : 'Paused';
  } else if (job.status === 'paused') requiredPackage = 'Paused';
  else if (job.status === 'running') requiredPackage = 'Checking / installing…';
  else requiredPackage = 'Pending';

  const error = preparationFailed || job.status === 'paused'
    ? run?.lastError
      ?? [...logs].reverse().find((line) => /error|fail|not authenticated/i.test(line))
      ?? 'Existing org preparation did not complete.'
    : undefined;

  return { authentication, requiredPackage, error };
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
