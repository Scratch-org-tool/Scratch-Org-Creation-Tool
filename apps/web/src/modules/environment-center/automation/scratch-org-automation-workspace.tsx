'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Clock,
  Database,
  GitBranch,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import {
  GlassCard,
  InlineAlert,
  PageHeader,
  StatusBadge,
  relativeTime,
} from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import {
  daysUntil,
  useScratchOrgRenewals,
  type RenewalConfigSummary,
  type RenewalPreview,
  type RenewalRecord,
  type RenewalRunRecord,
} from './use-scratch-org-renewals';

const MAX_LEAD_DAYS = 29;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ExpiryBadge({ expirationDate }: { expirationDate: string | null }) {
  const days = daysUntil(expirationDate);
  if (days === null) {
    return <span className="text-xs text-muted-foreground">no expiration known</span>;
  }
  const tone =
    days <= 2
      ? 'bg-red-500/15 text-red-400'
      : days <= 7
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-emerald-500/15 text-emerald-400';
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs', tone)}>
      {days < 0 ? 'expired' : days === 0 ? 'expires today' : `${days}d left`}
    </span>
  );
}

function StepsSummary({ summary }: { summary: RenewalConfigSummary }) {
  const items: Array<{ icon: typeof GitBranch; label: string; on: boolean }> = [
    { icon: GitBranch, label: summary.metadataSource ?? 'Metadata deploy', on: Boolean(summary.metadataSource) },
    { icon: Settings, label: 'Custom settings', on: summary.customSettings },
    { icon: Database, label: 'Data seed', on: summary.dataSeed },
    { icon: ArrowRight, label: 'Account partners', on: summary.accountPartners },
    { icon: Users, label: 'Users', on: summary.userProvisioning },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items
        .filter((item) => item.on)
        .map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            <item.icon className="size-3" />
            {item.label}
          </span>
        ))}
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
        <Clock className="size-3" />
        {summary.duration}d lifespan
      </span>
    </div>
  );
}

interface RenewalCardProps {
  renewal: RenewalRecord;
  onToggle: (id: string, enabled: boolean) => Promise<unknown>;
  onChangeLeadDays: (id: string, daysBeforeExpiry: number) => Promise<unknown>;
  onRunNow: (id: string) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  listRuns: (id: string) => Promise<RenewalRunRecord[]>;
}

function RenewalCard({
  renewal,
  onToggle,
  onChangeLeadDays,
  onRunNow,
  onRemove,
  listRuns,
}: RenewalCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadDays, setLeadDays] = useState(renewal.daysBeforeExpiry);
  const [showRuns, setShowRuns] = useState(false);
  const [runs, setRuns] = useState<RenewalRunRecord[] | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);

  useEffect(() => {
    setLeadDays(renewal.daysBeforeExpiry);
  }, [renewal.daysBeforeExpiry]);

  const wrap = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleRuns = async () => {
    const next = !showRuns;
    setShowRuns(next);
    if (next) {
      setRunsLoading(true);
      try {
        setRuns(await listRuns(renewal.id));
      } catch {
        setRuns([]);
      } finally {
        setRunsLoading(false);
      }
    }
  };

  const renewing = Boolean(renewal.activeAutomationRunId);

  return (
    <GlassCard className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{renewal.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{renewal.scratchOrgAlias}</span>
            <span>· expires {formatDate(renewal.trackedOrg.expirationDate)}</span>
            <ExpiryBadge expirationDate={renewal.trackedOrg.expirationDate} />
          </p>
        </div>
        <Switch
          checked={renewal.enabled}
          disabled={busy || renewing}
          onChange={(enabled) => void wrap(() => onToggle(renewal.id, enabled))}
          aria-label={`Enable automation for ${renewal.scratchOrgAlias}`}
        />
      </div>

      {error && (
        <InlineAlert variant="error" className="mt-3" onDismiss={() => setError(null)}>
          {error}
        </InlineAlert>
      )}

      <div className="mt-3 space-y-2 rounded-lg border border-border/60 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
          {renewing ? (
            <span>
              Renewing now — creating{' '}
              <span className="font-mono">{renewal.activeRunAlias}</span>
            </span>
          ) : renewal.enabled && renewal.nextRunAt ? (
            <span>
              Renews {relativeTime(renewal.nextRunAt)} ({formatDateTime(renewal.nextRunAt)})
            </span>
          ) : (
            <span className="text-muted-foreground">
              {renewal.enabled ? 'Waiting for the next cycle' : 'Automation disabled'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Recreate</span>
          <Input
            type="number"
            min={1}
            max={MAX_LEAD_DAYS}
            value={leadDays}
            disabled={busy}
            className="h-7 w-16 text-xs"
            onChange={(event) => setLeadDays(Number(event.target.value))}
            onBlur={() => {
              const clamped = Math.min(Math.max(Math.round(leadDays) || 1, 1), MAX_LEAD_DAYS);
              setLeadDays(clamped);
              if (clamped !== renewal.daysBeforeExpiry) {
                void wrap(() => onChangeLeadDays(renewal.id, clamped));
              }
            }}
            aria-label="Days before expiry"
          />
          <span className="text-muted-foreground">days before expiry</span>
        </div>
      </div>

      <div className="mt-3">
        <StepsSummary summary={renewal.summary} />
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {renewal.lastRunStatus ? (
          <>
            <StatusBadge status={renewal.lastRunStatus} />
            {renewal.lastRunAt && (
              <span className="text-muted-foreground">
                last renewal {relativeTime(renewal.lastRunAt)}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Never renewed yet</span>
        )}
        {renewing && renewal.activeAutomationRunId && (
          <Link
            href={`/environment-center/create-scratch-org?runId=${encodeURIComponent(renewal.activeAutomationRunId)}`}
            className="ml-auto text-primary hover:underline"
          >
            View progress
          </Link>
        )}
      </div>
      {renewal.lastError && renewal.lastRunStatus !== 'succeeded' && (
        <p className="mt-2 break-words text-xs text-red-400">{renewal.lastError}</p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-3">
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          disabled={renewing}
          onClick={() => void wrap(() => onRunNow(renewal.id))}
        >
          <Play className="mr-1.5 size-4" />
          Renew now
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void toggleRuns()}>
          History
          <ChevronDown className={cn('ml-1 size-4 transition-transform', showRuns && 'rotate-180')} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto text-muted-foreground hover:text-red-400"
          aria-label={`Delete automation for ${renewal.scratchOrgAlias}`}
          disabled={busy}
          onClick={() => void wrap(() => onRemove(renewal.id))}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {showRuns && (
        <div className="mt-3 border-t border-border/50 pt-3">
          {runsLoading ? (
            <Skeleton className="h-16 w-full rounded-md" />
          ) : !runs || runs.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">No renewals recorded yet.</p>
          ) : (
            <div className="space-y-1">
              {runs.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center gap-2 py-1 text-xs">
                  <StatusBadge status={run.status} />
                  <span className="font-mono text-muted-foreground">
                    {run.sourceAlias}
                    {run.newAlias ? ` → ${run.newAlias}` : ''}
                  </span>
                  <span className="text-muted-foreground">{run.trigger}</span>
                  <span className="ml-auto text-muted-foreground">{relativeTime(run.startedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

export function ScratchOrgAutomationWorkspace() {
  const {
    renewals,
    scratchOrgs,
    loading,
    error,
    refresh,
    preview,
    create,
    update,
    remove,
    runNow,
    listRuns,
  } = useScratchOrgRenewals();

  const [showForm, setShowForm] = useState(false);
  const [selectedAlias, setSelectedAlias] = useState('');
  const [leadDays, setLeadDays] = useState(2);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<RenewalPreview | null>(null);

  const trackedAliases = useMemo(
    () => new Set(renewals.map((rule) => rule.scratchOrgAlias)),
    [renewals],
  );
  const availableOrgs = useMemo(
    () => scratchOrgs.filter((org) => !trackedAliases.has(org.alias)),
    [scratchOrgs, trackedAliases],
  );

  useEffect(() => {
    if (!selectedAlias) {
      setPreviewResult(null);
      return;
    }
    let stale = false;
    setPreviewLoading(true);
    setPreviewResult(null);
    preview(selectedAlias)
      .then((result) => {
        if (!stale) setPreviewResult(result);
      })
      .catch((err) => {
        if (!stale) {
          setPreviewResult({
            eligible: false,
            reason: err instanceof Error ? err.message : 'Preview failed',
            scratchOrg: { alias: selectedAlias, expirationDate: null },
            sourceRun: null,
            summary: null,
          });
        }
      })
      .finally(() => {
        if (!stale) setPreviewLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [selectedAlias, preview]);

  const renewOnDate = useMemo(() => {
    const expiration = previewResult?.scratchOrg.expirationDate;
    if (!expiration) return null;
    return new Date(new Date(expiration).getTime() - leadDays * 24 * 60 * 60 * 1000);
  }, [previewResult, leadDays]);

  const canSubmit = Boolean(
    selectedAlias && previewResult?.eligible && leadDays >= 1 && leadDays <= MAX_LEAD_DAYS && !saving,
  );

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setFormError(null);
    try {
      await create({ scratchOrgAlias: selectedAlias, daysBeforeExpiry: leadDays });
      setSelectedAlias('');
      setPreviewResult(null);
      setLeadDays(2);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create automation');
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = renewals.filter((rule) => rule.enabled).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Scratch Org Automation"
        subtitle="Auto-renew scratch orgs before they expire: the original creation pipeline is replayed — metadata, credentials, custom settings, data and users — so a fresh, fully loaded replacement is ready ahead of the 30-day limit."
        meta={
          renewals.length
            ? `${renewals.length} automation${renewals.length === 1 ? '' : 's'} · ${enabledCount} enabled`
            : undefined
        }
        showBreadcrumbs={false}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()} loading={loading}>
              <RefreshCw className="mr-1.5 size-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm((value) => !value)}>
              <Plus className="mr-1.5 size-4" />
              New automation
            </Button>
          </>
        }
      />

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {showForm && (
        <GlassCard
          title="New renewal automation"
          description="Pick a scratch org created through the pipeline. Its saved launch configuration — including data seeding — is replayed automatically before the org expires."
        >
          <div className="space-y-4">
            {formError && (
              <InlineAlert variant="error" onDismiss={() => setFormError(null)}>
                {formError}
              </InlineAlert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="renewal-org">Scratch org</Label>
                <Select
                  id="renewal-org"
                  value={selectedAlias}
                  onChange={(event) => setSelectedAlias(event.target.value)}
                >
                  <option value="">Select scratch org…</option>
                  {availableOrgs.map((org) => (
                    <option key={org.id} value={org.alias}>
                      {org.alias}
                      {org.expirationDate ? ` — expires ${formatDate(org.expirationDate)}` : ''}
                    </option>
                  ))}
                </Select>
                {availableOrgs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Every scratch org already has an automation, or none exist yet.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="renewal-lead">Recreate this many days before expiry</Label>
                <Input
                  id="renewal-lead"
                  type="number"
                  min={1}
                  max={MAX_LEAD_DAYS}
                  value={leadDays}
                  onChange={(event) => setLeadDays(Number(event.target.value))}
                />
              </div>
            </div>

            {previewLoading && <Skeleton className="h-20 w-full rounded-md" />}

            {previewResult && !previewLoading && (
              previewResult.eligible ? (
                <div className="space-y-2 rounded-lg border border-border/60 p-3 text-xs">
                  <p>
                    <span className="text-muted-foreground">Expires:</span>{' '}
                    {formatDate(previewResult.scratchOrg.expirationDate)}
                    {renewOnDate && (
                      <>
                        {' '}· <span className="text-muted-foreground">Will renew:</span>{' '}
                        {renewOnDate.getTime() <= Date.now()
                          ? 'immediately (already inside the renewal window)'
                          : renewOnDate.toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                      </>
                    )}
                  </p>
                  {previewResult.sourceRun && (
                    <p className="text-muted-foreground">
                      Replays the pipeline run from {formatDate(previewResult.sourceRun.createdAt)} with a fresh alias.
                    </p>
                  )}
                  {previewResult.summary && <StepsSummary summary={previewResult.summary} />}
                </div>
              ) : (
                <InlineAlert variant="warning">
                  {previewResult.reason ?? 'This scratch org cannot be renewed automatically.'}
                </InlineAlert>
              )
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void submit()} loading={saving} disabled={!canSubmit}>
                Create automation
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {loading && !renewals.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : renewals.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <RefreshCw className="size-6" />
            </span>
            <div>
              <p className="font-medium">No renewal automations yet</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Scratch orgs expire after at most 30 days. Add an automation so a fully configured
                replacement — same metadata, credentials, data and users — is created before that happens.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 size-4" />
              New automation
            </Button>
          </div>
        </GlassCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {renewals.map((renewal) => (
            <RenewalCard
              key={renewal.id}
              renewal={renewal}
              onToggle={(id, enabled) => update(id, { enabled })}
              onChangeLeadDays={(id, daysBeforeExpiry) => update(id, { daysBeforeExpiry })}
              onRunNow={runNow}
              onRemove={remove}
              listRuns={listRuns}
            />
          ))}
        </div>
      )}
    </div>
  );
}
