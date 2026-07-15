'use client';

import type { AutomationRunView } from '@/components/scratch-org/types';
import type { QueryRuntimeCheckpoint, ResolvedProvisionUser, ScratchPipelineTemplateConfig } from '@sfcc/shared';
import { cn } from '@/utils/cn';
import { latestJobOfType } from './template-v2-progress-utils';

type State = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

function StatePill({ state }: { state: State }) {
  return (
    <span className={cn(
      'rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize',
      state === 'completed' && 'border-green-500/30 bg-green-500/10 text-green-500',
      state === 'running' && 'border-blue-500/30 bg-blue-500/10 text-blue-500',
      state === 'failed' && 'border-destructive/30 bg-destructive/10 text-destructive',
      state === 'skipped' && 'border-border bg-muted/30 text-muted-foreground',
      state === 'pending' && 'border-border text-muted-foreground',
    )}>
      {state}
    </span>
  );
}

function jobState(run: AutomationRunView, type: string): State {
  const job = latestJobOfType(run.jobs, type);
  if (!job) return 'pending';
  if (job.status === 'completed') return 'completed';
  if (job.status === 'failed') return 'failed';
  if (['running', 'queued'].includes(job.status)) return 'running';
  return 'pending';
}

function parseUsers(run: AutomationRunView): ResolvedProvisionUser[] {
  const job = latestJobOfType(run.jobs, 'cona_user_provision');
  const users = job?.payload?.users;
  return Array.isArray(users) ? users as ResolvedProvisionUser[] : [];
}

function userState(run: AutomationRunView, user: ResolvedProvisionUser, index: number): State {
  const job = latestJobOfType(run.jobs, 'cona_user_provision');
  if (!job) return 'pending';
  const logs = job.logs?.map((log) => log.line) ?? [];
  const identity = user.username ?? user.email;
  if (logs.some((line) => line.includes(identity) && /failed|error/i.test(line))) return 'failed';
  if (logs.some((line) => line.includes(identity) && /Provisioned user|Skipping completed user/i.test(line))) {
    return 'completed';
  }
  if (job.status === 'completed') return 'completed';
  if (job.status === 'failed') {
    const completedBefore = logs.filter((line) => /Provisioned user|Skipping completed user/i.test(line)).length;
    return index === completedBefore ? 'failed' : 'pending';
  }
  if (job.status === 'running') {
    const completedBefore = logs.filter((line) => /Provisioned user|Skipping completed user/i.test(line)).length;
    return index === completedBefore ? 'running' : 'pending';
  }
  return 'pending';
}

export function TemplateV2Progress({ run }: { run: AutomationRunView }) {
  const config = run.config as ScratchPipelineTemplateConfig | undefined;
  if (config?.version !== 2) return null;
  const checkpoint = (run.checkpoint as { querySection?: QueryRuntimeCheckpoint } | undefined)?.querySection;
  const sourceQueries = config.dataSeed?.querySection?.queries ?? [];
  const orderedSources = [...sourceQueries].sort(
    (left, right) => left.stage - right.stage || left.order - right.order,
  );
  const queryRows = checkpoint
    ? Object.values(checkpoint.queries).map((state, index) => {
        const sourceId = state.id.split(':')[0];
        const source = sourceQueries.find((query) => query.id === sourceId);
        return {
          id: state.id,
          name: state.id === sourceId ? (source?.name ?? state.id) : `${source?.name ?? sourceId} (${state.id.slice(sourceId.length + 1)})`,
          stage: source?.stage ?? index,
          order: source?.order ?? index,
          state,
        };
      })
    : orderedSources.map((query) => ({
        id: query.id,
        name: query.name,
        stage: query.stage,
        order: query.order,
        state: undefined,
      }));
  const users = parseUsers(run);
  const dataJob = latestJobOfType(run.jobs, 'cona_seed');
  const partnerLog = dataJob?.logs
    ?.map((log) => {
      try {
        return JSON.parse(log.line) as {
          partnerJoin?: {
            rows?: unknown[];
            skippedMissingAccount?: number;
            skippedMissingEmployee?: number;
          };
        };
      } catch {
        return null;
      }
    })
    .findLast((entry) => entry?.partnerJoin)?.partnerJoin;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card/30 p-3" aria-label="Template V2 progress">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Template V2 deployment</p>
        <span className="text-[10px] text-muted-foreground">Retries resume saved query/user checkpoints</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between rounded-md border border-border/50 p-2">
          <span>Custom settings / SFDMU</span>
          <StatePill state={config.customSettings?.enabled === false ? 'skipped' : jobState(run, 'custom_settings_load')} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/50 p-2">
          <span>Org configuration</span>
          <StatePill state={jobState(run, 'pipeline_load_org_config')} />
        </div>
      </div>

      {queryRows.length > 0 && (
        <section aria-labelledby="query-progress-title">
          <h4 id="query-progress-title" className="text-xs font-medium mb-2">Ordered queries</h4>
          <ol className="space-y-1.5">
            {queryRows.map((query) => {
              const state = query.state;
              return (
                <li key={query.id} className="flex items-center gap-2 rounded-md border border-border/50 p-2 text-xs">
                  <span className="font-mono text-muted-foreground">{query.stage}:{query.order}</span>
                  <span className="min-w-0 flex-1 truncate">{query.name}</span>
                  {state && <span className="text-muted-foreground">{state.exported} exported · {state.loaded} loaded</span>}
                  <StatePill state={state?.status ?? 'pending'} />
                </li>
              );
            })}
          </ol>
          {config.dataSeed?.querySection?.accountPartnerPlan && (
            <div className="mt-2 rounded-md border border-border/50 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Account Partner join</span>
                <StatePill state={
                  checkpoint?.queries?.[config.dataSeed.querySection.accountPartnerPlan.accountPartnerQueryId]?.status
                  ?? 'pending'
                } />
              </div>
              {partnerLog && (
                <p className="text-muted-foreground mt-1">
                  {partnerLog.rows?.length ?? 0} joined · {partnerLog.skippedMissingAccount ?? 0} missing accounts · {partnerLog.skippedMissingEmployee ?? 0} missing employees
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {users.length > 0 && (
        <section aria-labelledby="user-progress-title">
          <h4 id="user-progress-title" className="text-xs font-medium mb-2">Sequential user batch</h4>
          <ol className="space-y-1.5">
            {users.map((user, index) => (
              <li key={`${user.username ?? user.email}-${index}`} className="grid sm:grid-cols-[auto_1fr_1fr_auto] gap-2 rounded-md border border-border/50 p-2 text-xs">
                <span className="text-muted-foreground">{index + 1}</span>
                <span>{user.role}<br /><span className="text-muted-foreground">{user.firstName} {user.lastName}</span></span>
                <span className="break-all"><strong>Email:</strong> {user.email}<br /><strong>Username:</strong> {user.username}</span>
                <StatePill state={userState(run, user, index)} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
