'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, GitCompare, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  CURATED_COMPARE_TYPES,
  describeSchedule,
  type DeploymentSchedule,
} from '@sfcc/shared';
import { ConfirmDialog, GlassCard, InlineAlert, PageHeader, StatusBadge, relativeTime } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { useOrgs } from '@/hooks/use-orgs';
import { DEFAULT_SCHEDULE, ScheduleFields } from '@/components/schedule-fields';
import { useDriftMonitors, type CreateMonitorInput } from './use-drift';

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

interface CreateFormState {
  name: string;
  description: string;
  sourceOrgId: string;
  targetOrgId: string;
  types: string[];
  scheduleEnabled: boolean;
  schedule: DeploymentSchedule;
  notifyOnDrift: boolean;
}

const EMPTY_FORM: CreateFormState = {
  name: '',
  description: '',
  sourceOrgId: '',
  targetOrgId: '',
  types: [],
  scheduleEnabled: false,
  schedule: DEFAULT_SCHEDULE,
  notifyOnDrift: true,
};

export function DriftWorkspace() {
  const {
    monitors,
    loading,
    error,
    actionError,
    clearActionError,
    checkingId,
    removingId,
    refresh,
    create,
    runNow,
    remove,
  } = useDriftMonitors();
  const { orgs } = useOrgs();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      // The hook surfaces the error; keep the dialog open so the user can retry.
    }
  };

  const orgAlias = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of orgs) map.set(org.id, org.alias);
    return map;
  }, [orgs]);

  const canSubmit =
    form.name.trim() &&
    form.sourceOrgId &&
    form.targetOrgId &&
    form.sourceOrgId !== form.targetOrgId;

  const toggleType = (type: string) => {
    setForm((current) => ({
      ...current,
      types: current.types.includes(type)
        ? current.types.filter((value) => value !== type)
        : [...current.types, type],
    }));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setFormError(null);
    const payload: CreateMonitorInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      sourceOrgId: form.sourceOrgId,
      targetOrgId: form.targetOrgId,
      metadataTypes: form.types.length ? form.types : undefined,
      scheduleEnabled: form.scheduleEnabled,
      schedule: form.scheduleEnabled ? form.schedule : undefined,
      notifyOnDrift: form.notifyOnDrift,
    };
    try {
      await create(payload);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create monitor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Drift monitoring"
        subtitle="Watch a source org against a target and get alerted when they drift apart."
        showBreadcrumbs={false}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()} loading={loading}>
              <RefreshCw className="mr-1.5 size-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm((value) => !value)}>
              <Plus className="mr-1.5 size-4" />
              New monitor
            </Button>
          </>
        }
      />

      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      {actionError && (
        <InlineAlert variant="error" onDismiss={clearActionError}>
          {actionError}
        </InlineAlert>
      )}

      {showForm && (
        <GlassCard title="New drift monitor" description="Compare two orgs on a schedule you control.">
          <div className="space-y-4">
            {formError && (
              <InlineAlert variant="error" onDismiss={() => setFormError(null)}>
                {formError}
              </InlineAlert>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="monitor-name">Name</Label>
                <Input
                  id="monitor-name"
                  value={form.name}
                  placeholder="Prod vs. UAT"
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="monitor-description">Description (optional)</Label>
                <Input
                  id="monitor-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="monitor-source">Source org (source of truth)</Label>
                <Select
                  id="monitor-source"
                  value={form.sourceOrgId}
                  onChange={(event) => setForm({ ...form, sourceOrgId: event.target.value })}
                >
                  <option value="">Select org…</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.alias}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="monitor-target">Target org (checked for drift)</Label>
                <Select
                  id="monitor-target"
                  value={form.targetOrgId}
                  onChange={(event) => setForm({ ...form, targetOrgId: event.target.value })}
                >
                  <option value="">Select org…</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id} disabled={org.id === form.sourceOrgId}>
                      {org.alias}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Metadata types</Label>
              <p className="text-xs text-muted-foreground">
                Leave all off to watch a sensible default set.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CURATED_COMPARE_TYPES.map((type) => {
                  const active = form.types.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-border/60 text-muted-foreground hover:border-primary/30',
                      )}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Run automatically</p>
                  <p className="text-xs text-muted-foreground">
                    {form.scheduleEnabled ? describeSchedule(form.schedule) : 'Manual checks only'}
                  </p>
                </div>
                <Switch
                  checked={form.scheduleEnabled}
                  onChange={(checked) => setForm({ ...form, scheduleEnabled: checked })}
                  aria-label="Run automatically"
                />
              </div>
              {form.scheduleEnabled && (
                <ScheduleFields
                  value={form.schedule}
                  onChange={(schedule) => setForm({ ...form, schedule })}
                  idPrefix="monitor-schedule"
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Alert me on new drift</p>
                <p className="text-xs text-muted-foreground">
                  Sends a notification when new differences appear (if an admin has notifications on).
                </p>
              </div>
              <Switch
                checked={form.notifyOnDrift}
                onChange={(checked) => setForm({ ...form, notifyOnDrift: checked })}
                aria-label="Alert me on new drift"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void submit()} loading={saving} disabled={!canSubmit}>
                Create monitor
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {loading && !monitors.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : monitors.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <GitCompare className="size-6" />
            </span>
            <div>
              <p className="font-medium">No drift monitors yet</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Create a monitor to track how a target org drifts from your source of truth over time.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 size-4" />
              New monitor
            </Button>
          </div>
        </GlassCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {monitors.map((monitor) => (
            <GlassCard key={monitor.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/drift/${monitor.id}`}
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {monitor.name}
                  </Link>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{orgAlias.get(monitor.sourceOrgId) ?? 'source'}</span>
                    <ArrowRight className="size-3 shrink-0" />
                    <span className="truncate">{orgAlias.get(monitor.targetOrgId) ?? 'target'}</span>
                  </p>
                </div>
                <StatusBadge
                  status={monitor.lastStatus ?? 'pending'}
                  label={statusLabel(monitor.lastStatus)}
                  className={cn(DRIFT_STATUS_STYLES[monitor.lastStatus ?? ''] ?? 'bg-secondary text-muted-foreground')}
                />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Differences</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                    {monitor.lastDriftCount ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last checked</dt>
                  <dd className="mt-0.5">
                    {monitor.lastCheckedAt ? relativeTime(monitor.lastCheckedAt) : 'Never'}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-xs text-muted-foreground">
                {monitor.scheduleEnabled && monitor.schedule
                  ? describeSchedule(monitor.schedule)
                  : 'Manual checks only'}
              </p>

              <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void runNow(monitor.id)}
                  disabled={monitor.lastStatus === 'checking'}
                  loading={monitor.lastStatus === 'checking' || checkingId === monitor.id}
                >
                  Check now
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/drift/${monitor.id}`}>View history</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto text-muted-foreground hover:text-red-400"
                  aria-label={`Delete ${monitor.name}`}
                  loading={removingId === monitor.id}
                  disabled={Boolean(removingId)}
                  onClick={() => setPendingDelete({ id: monitor.id, name: monitor.name })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete drift monitor?"
        message={`"${pendingDelete?.name ?? ''}" and its snapshot history will be permanently removed.`}
        confirmLabel="Delete monitor"
        loading={Boolean(removingId)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
