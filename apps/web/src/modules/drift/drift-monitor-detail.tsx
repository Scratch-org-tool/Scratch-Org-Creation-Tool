'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, RefreshCw, Wand2 } from 'lucide-react';
import {
  describeSchedule,
  driftItemKey,
  type DriftItem,
  type DriftRemediationPlan,
  type DriftSnapshotRecord,
} from '@sfcc/shared';
import {
  GlassCard,
  InlineAlert,
  PageHeader,
  StatCard,
  StatCardGrid,
  StatusBadge,
  relativeTime,
} from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { useOrgs } from '@/hooks/use-orgs';
import { api } from '@/services/api';
import { DEFAULT_SCHEDULE, ScheduleFields } from '@/components/schedule-fields';
import { useDriftMonitor } from './use-drift';

type RemediationPreview = DriftRemediationPlan & {
  snapshotId: string;
  snapshotCreatedAt: string;
};

const DIFF_BADGE_STYLES: Record<DriftItem['diffType'], string> = {
  new: 'bg-emerald-500/15 text-emerald-400',
  changed: 'bg-amber-500/15 text-amber-400',
  deleted: 'bg-red-500/15 text-red-400',
};

const DIFF_LABELS: Record<DriftItem['diffType'], string> = {
  new: 'In source only',
  changed: 'Changed',
  deleted: 'In target only',
};

const DRIFT_STATUS_STYLES: Record<string, string> = {
  clean: 'bg-emerald-500/15 text-emerald-400',
  drifted: 'bg-amber-500/15 text-amber-400',
  failed: 'bg-red-500/15 text-red-400',
  checking: 'bg-blue-500/15 text-blue-400',
};

function statusLabel(status: string | null): string {
  if (!status) return 'Not checked';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function DriftMonitorDetail({ monitorId }: { monitorId: string }) {
  const { monitor, snapshots, loading, error, runNow, update, getSnapshot } =
    useDriftMonitor(monitorId);
  const { orgs } = useOrgs();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DriftSnapshotRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [notifyOnDrift, setNotifyOnDrift] = useState(true);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  const [remediation, setRemediation] = useState<RemediationPreview | null>(null);
  const [remediationOpen, setRemediationOpen] = useState(false);
  const [remediationLoading, setRemediationLoading] = useState(false);
  const [remediationBusy, setRemediationBusy] = useState(false);
  const [includeDeletions, setIncludeDeletions] = useState(false);
  const [validateOnly, setValidateOnly] = useState(false);
  const [remediationNotice, setRemediationNotice] = useState<string | null>(null);
  const [remediationError, setRemediationError] = useState<string | null>(null);

  const openRemediation = async () => {
    setRemediationOpen(true);
    setRemediationLoading(true);
    setRemediationError(null);
    setRemediationNotice(null);
    try {
      const preview = await api<RemediationPreview>(
        `/drift/monitors/${encodeURIComponent(monitorId)}/remediate/preview${
          selectedId ? `?snapshotId=${encodeURIComponent(selectedId)}` : ''
        }`,
      );
      setRemediation(preview);
    } catch (err) {
      setRemediation(null);
      setRemediationError(err instanceof Error ? err.message : 'Failed to build remediation preview');
    } finally {
      setRemediationLoading(false);
    }
  };

  const runRemediation = async () => {
    if (!remediation) return;
    setRemediationBusy(true);
    setRemediationError(null);
    try {
      const result = await api<{ deploymentId?: string; jobId?: string }>(
        `/drift/monitors/${encodeURIComponent(monitorId)}/remediate`,
        {
          method: 'POST',
          body: JSON.stringify({
            snapshotId: remediation.snapshotId,
            includeDeletions,
            validateOnly,
          }),
        },
      );
      setRemediationNotice(
        validateOnly
          ? 'Validation deploy started — check Monitoring for the result, then run a real remediation.'
          : `Remediation deployment started${result.deploymentId ? ` (${result.deploymentId.slice(0, 8)}…)` : ''}. Run a drift check after it completes to confirm the orgs are back in sync.`,
      );
    } catch (err) {
      setRemediationError(err instanceof Error ? err.message : 'Failed to start remediation');
    } finally {
      setRemediationBusy(false);
    }
  };

  const orgAlias = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of orgs) map.set(org.id, org.alias);
    return map;
  }, [orgs]);

  useEffect(() => {
    if (!monitor) return;
    setScheduleEnabled(monitor.scheduleEnabled);
    setSchedule(monitor.schedule ?? DEFAULT_SCHEDULE);
    setNotifyOnDrift(monitor.notifyOnDrift);
  }, [monitor]);

  // Default the diff panel to the most recent snapshot.
  useEffect(() => {
    if (!selectedId && snapshots.length) setSelectedId(snapshots[0]!.id);
  }, [snapshots, selectedId]);

  const loadDetail = useCallback(
    async (snapshotId: string) => {
      setDetailLoading(true);
      try {
        setDetail(await getSnapshot(snapshotId));
      } catch {
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [getSnapshot],
  );

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const newlyDriftedKeys = useMemo(() => {
    return new Set((detail?.newlyDrifted ?? []).map(driftItemKey));
  }, [detail]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, DriftItem[]>();
    for (const item of detail?.items ?? []) {
      const list = groups.get(item.metadataType) ?? [];
      list.push(item);
      groups.set(item.metadataType, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [detail]);

  const latest = snapshots[0];

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsNotice(null);
    try {
      await update({
        scheduleEnabled,
        schedule: scheduleEnabled ? schedule : undefined,
        notifyOnDrift,
      });
      setSettingsNotice('Settings saved.');
    } catch (err) {
      setSettingsNotice(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading && !monitor) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!monitor) {
    return (
      <div className="p-4 md:p-6">
        <InlineAlert variant="error">{error ?? 'Drift monitor not found.'}</InlineAlert>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/drift">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to monitors
          </Link>
        </Button>
      </div>
    );
  }

  const checking = monitor.lastStatus === 'checking';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <Link
          href="/drift"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Drift monitoring
        </Link>
        <PageHeader
          title={monitor.name}
          subtitle={monitor.description ?? undefined}
          showBreadcrumbs={false}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void openRemediation()}
                disabled={checking || (monitor.lastStatus !== 'drifted' && !remediationOpen)}
                title={monitor.lastStatus !== 'drifted' ? 'Available when drift is detected' : undefined}
              >
                <Wand2 className="mr-1.5 size-4" />
                Remediate
              </Button>
              <Button size="sm" onClick={() => void runNow()} loading={checking} disabled={checking}>
                <RefreshCw className="mr-1.5 size-4" />
                Check now
              </Button>
            </>
          }
        />
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>{orgAlias.get(monitor.sourceOrgId) ?? 'source'}</span>
          <ArrowRight className="size-3.5" />
          <span>{orgAlias.get(monitor.targetOrgId) ?? 'target'}</span>
        </p>
      </div>

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      <StatCardGrid cols={4}>
        <StatCard
          label="Status"
          value={statusLabel(monitor.lastStatus)}
          className={cn(DRIFT_STATUS_STYLES[monitor.lastStatus ?? ''] ? 'border-transparent' : '')}
        />
        <StatCard label="Total differences" value={latest?.totalDifferences ?? monitor.lastDriftCount ?? 0} />
        <StatCard label="Changed" value={latest?.changed ?? 0} />
        <StatCard
          label="Added / removed"
          value={`${latest?.added ?? 0} / ${latest?.removed ?? 0}`}
        />
      </StatCardGrid>

      {remediationOpen && (
        <GlassCard
          title="Drift remediation"
          description="Deploys the drifted components from the source org onto the target so they match again."
          headerAction={(
            <Button size="sm" variant="ghost" onClick={() => setRemediationOpen(false)}>
              Close
            </Button>
          )}
        >
          {remediationError && (
            <div className="mb-3">
              <InlineAlert variant="error" onDismiss={() => setRemediationError(null)}>
                {remediationError}
              </InlineAlert>
            </div>
          )}
          {remediationNotice && (
            <div className="mb-3">
              <InlineAlert variant="success" onDismiss={() => setRemediationNotice(null)}>
                {remediationNotice}
              </InlineAlert>
            </div>
          )}
          {remediationLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : !remediation ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No drifted snapshot available to remediate from.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Based on the check from {relativeTime(remediation.snapshotCreatedAt)}:{' '}
                <span className="text-foreground">{remediation.deployCount}</span> component
                {remediation.deployCount === 1 ? '' : 's'} will be deployed
                {remediation.deleteCount > 0 && (
                  <>
                    {' '}and <span className="text-foreground">{remediation.deleteCount}</span>{' '}
                    target-only component{remediation.deleteCount === 1 ? '' : 's'} can optionally be deleted
                  </>
                )}
                .
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                    Deploy to target ({remediation.deployCount})
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                    {remediation.deploySelections.map((selection) => (
                      <li key={selection.metadataType}>
                        <span className="text-muted-foreground">{selection.metadataType}:</span>{' '}
                        {selection.members.slice(0, 8).join(', ')}
                        {selection.members.length > 8 ? ` +${selection.members.length - 8} more` : ''}
                      </li>
                    ))}
                    {remediation.deploySelections.length === 0 && (
                      <li className="text-muted-foreground">Nothing to deploy.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-400">
                    Delete from target ({remediation.deleteCount})
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                    {remediation.deleteSelections.map((selection) => (
                      <li key={selection.metadataType}>
                        <span className="text-muted-foreground">{selection.metadataType}:</span>{' '}
                        {selection.members.slice(0, 8).join(', ')}
                        {selection.members.length > 8 ? ` +${selection.members.length - 8} more` : ''}
                      </li>
                    ))}
                    {remediation.deleteSelections.length === 0 && (
                      <li className="text-muted-foreground">Nothing extra on the target.</li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={validateOnly}
                    onChange={setValidateOnly}
                    size="sm"
                    aria-label="Validate only"
                  />
                  Validate only (no changes saved)
                </label>
                {remediation.deleteCount > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={includeDeletions}
                      onChange={setIncludeDeletions}
                      size="sm"
                      aria-label="Also delete target-only components"
                    />
                    Also delete the {remediation.deleteCount} target-only component
                    {remediation.deleteCount === 1 ? '' : 's'}
                  </label>
                )}
                <div className="ml-auto">
                  <Button
                    size="sm"
                    onClick={() => void runRemediation()}
                    loading={remediationBusy}
                    disabled={remediation.deployCount === 0}
                  >
                    <Wand2 className="mr-1.5 size-4" />
                    {validateOnly ? 'Validate remediation' : 'Deploy remediation'}
                  </Button>
                </div>
              </div>
              {includeDeletions && (
                <InlineAlert variant="warning">
                  Destructive changes permanently delete components from the target org. Consider a
                  validate-only run first.
                </InlineAlert>
              )}
            </div>
          )}
        </GlassCard>
      )}

      <GlassCard title="Automation & alerts">
        <div className="space-y-4">
          {settingsNotice && (
            <InlineAlert
              variant={settingsNotice === 'Settings saved.' ? 'success' : 'error'}
              onDismiss={() => setSettingsNotice(null)}
            >
              {settingsNotice}
            </InlineAlert>
          )}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">Run automatically</p>
              <p className="text-xs text-muted-foreground">
                {scheduleEnabled ? describeSchedule(schedule) : 'Manual checks only'}
                {monitor.scheduleEnabled && monitor.nextRunAt
                  ? ` · next ${relativeTime(monitor.nextRunAt)}`
                  : ''}
              </p>
            </div>
            <Switch
              checked={scheduleEnabled}
              onChange={setScheduleEnabled}
              aria-label="Run automatically"
            />
          </div>
          {scheduleEnabled && (
            <ScheduleFields value={schedule} onChange={setSchedule} idPrefix="detail-schedule" />
          )}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">Alert me on new drift</p>
              <p className="text-xs text-muted-foreground">
                Notify when new differences appear (requires an admin to enable notifications).
              </p>
            </div>
            <Switch checked={notifyOnDrift} onChange={setNotifyOnDrift} aria-label="Alert me on new drift" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void saveSettings()} loading={savingSettings}>
              Save settings
            </Button>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <GlassCard title="Check history" noPadding>
          <div className="max-h-[520px] overflow-y-auto scrollbar-thin p-2">
            {snapshots.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                No checks yet. Run one to establish a baseline.
              </p>
            ) : (
              snapshots.map((snapshot) => (
                <button
                  key={snapshot.id}
                  type="button"
                  onClick={() => setSelectedId(snapshot.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors',
                    selectedId === snapshot.id ? 'bg-secondary/70' : 'hover:bg-secondary/40',
                  )}
                >
                  <StatusBadge
                    status={snapshot.status}
                    label={statusLabel(snapshot.status)}
                    className={DRIFT_STATUS_STYLES[snapshot.status] ?? 'bg-secondary text-muted-foreground'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {snapshot.status === 'failed'
                        ? snapshot.error ?? 'Check failed'
                        : `${snapshot.totalDifferences} difference${snapshot.totalDifferences === 1 ? '' : 's'}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {relativeTime(snapshot.createdAt)} · {snapshot.trigger}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard
          title="Differences"
          description={
            detail
              ? `${detail.totalDifferences} difference${detail.totalDifferences === 1 ? '' : 's'}${
                  detail.newlyDrifted?.length ? ` · ${detail.newlyDrifted.length} new` : ''
                }`
              : undefined
          }
        >
          {detailLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ) : !detail || detail.status === 'failed' ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {detail?.error ?? 'Select a check to see its differences.'}
            </p>
          ) : detail.totalDifferences === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No differences — the orgs were in sync at this check.
            </p>
          ) : (
            <div className="space-y-4">
              {groupedItems.map(([type, items]) => (
                <div key={type}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {type} <span className="text-muted-foreground/60">({items.length})</span>
                  </p>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const isNew = newlyDriftedKeys.has(driftItemKey(item));
                      return (
                        <div
                          key={`${item.fullName}:${item.diffType}`}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/40"
                        >
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px]',
                              DIFF_BADGE_STYLES[item.diffType],
                            )}
                          >
                            {DIFF_LABELS[item.diffType]}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.fullName}</span>
                          {isNew && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                              new
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
