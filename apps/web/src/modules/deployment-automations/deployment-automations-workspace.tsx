'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { describeSchedule, type DeploymentSchedule } from '@sfcc/shared';
import {
  GlassCard,
  InlineAlert,
  PageHeader,
  StatusBadge,
  relativeTime,
} from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { useOrgs } from '@/hooks/use-orgs';
import { DEFAULT_SCHEDULE, ScheduleFields } from '@/components/schedule-fields';
import {
  useDeploymentAutomations,
  type CreatePlanInput,
  type PlanRecord,
  type PlanRunRecord,
} from './use-deployment-automations';

interface PlanCardProps {
  plan: PlanRecord;
  orgAlias: Map<string, string>;
  onExecute: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpdateSchedule: (
    id: string,
    schedule: DeploymentSchedule | null,
    scheduleEnabled: boolean,
  ) => Promise<PlanRecord>;
  listRuns: (id: string) => Promise<PlanRunRecord[]>;
}

function PlanCard({ plan, orgAlias, onExecute, onRemove, onUpdateSchedule, listRuns }: PlanCardProps) {
  const [editing, setEditing] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(plan.scheduleEnabled);
  const [schedule, setSchedule] = useState<DeploymentSchedule>(plan.schedule ?? DEFAULT_SCHEDULE);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showRuns, setShowRuns] = useState(false);
  const [runs, setRuns] = useState<PlanRunRecord[] | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);

  const saveSchedule = async () => {
    setSavingSchedule(true);
    setError(null);
    try {
      await onUpdateSchedule(plan.id, scheduleEnabled ? schedule : null, scheduleEnabled);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const execute = async () => {
    setBusy(true);
    setError(null);
    try {
      await onExecute(plan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run plan');
    } finally {
      setBusy(false);
    }
  };

  const toggleRuns = async () => {
    const next = !showRuns;
    setShowRuns(next);
    if (next && runs === null) {
      setRunsLoading(true);
      try {
        setRuns(await listRuns(plan.id));
      } catch {
        setRuns([]);
      } finally {
        setRunsLoading(false);
      }
    }
  };

  return (
    <GlassCard className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{plan.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{orgAlias.get(plan.sourceOrgId ?? '') ?? 'source'}</span>
            <ArrowRight className="size-3 shrink-0" />
            <span className="truncate">{orgAlias.get(plan.targetOrgId ?? '') ?? 'target'}</span>
            <span className="rounded-full bg-secondary px-1.5 py-0.5 uppercase tracking-wide">
              {plan.planType}
            </span>
          </p>
        </div>
        {plan.lastRunStatus ? (
          <StatusBadge status={plan.lastRunStatus} />
        ) : (
          <span className="text-xs text-muted-foreground">Never run</span>
        )}
      </div>

      {error && (
        <InlineAlert variant="error" className="mt-3" onDismiss={() => setError(null)}>
          {error}
        </InlineAlert>
      )}

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs">
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
        {plan.scheduleEnabled && plan.schedule ? (
          <span>
            {describeSchedule(plan.schedule)}
            {plan.nextRunAt ? ` · next ${relativeTime(plan.nextRunAt)}` : ''}
          </span>
        ) : (
          <span className="text-muted-foreground">No schedule — runs manually</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? 'Close' : plan.scheduleEnabled ? 'Edit' : 'Schedule'}
        </Button>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Run automatically</p>
              <p className="text-xs text-muted-foreground">
                {scheduleEnabled ? describeSchedule(schedule) : 'Manual only'}
              </p>
            </div>
            <Switch checked={scheduleEnabled} onChange={setScheduleEnabled} aria-label="Run automatically" />
          </div>
          {scheduleEnabled && (
            <ScheduleFields value={schedule} onChange={setSchedule} idPrefix={`plan-${plan.id}`} />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={savingSchedule}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void saveSchedule()} loading={savingSchedule}>
              Save schedule
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-3">
        <Button variant="secondary" size="sm" onClick={() => void execute()} loading={busy} disabled={!plan.enabled}>
          <Play className="mr-1.5 size-4" />
          Run now
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void toggleRuns()}>
          Run history
          <ChevronDown className={cn('ml-1 size-4 transition-transform', showRuns && 'rotate-180')} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto text-muted-foreground hover:text-red-400"
          aria-label={`Delete ${plan.name}`}
          onClick={() => void onRemove(plan.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {showRuns && (
        <div className="mt-3 border-t border-border/50 pt-3">
          {runsLoading ? (
            <Skeleton className="h-16 w-full rounded-md" />
          ) : !runs || runs.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">No runs recorded yet.</p>
          ) : (
            <div className="space-y-1">
              {runs.map((run) => (
                <div key={run.id} className="flex items-center gap-2 py-1 text-xs">
                  <StatusBadge status={run.status} />
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

interface CreateFormState {
  name: string;
  description: string;
  sourceOrgId: string;
  targetOrgId: string;
  packageXml: string;
}

const EMPTY_FORM: CreateFormState = {
  name: '',
  description: '',
  sourceOrgId: '',
  targetOrgId: '',
  packageXml: '',
};

export function DeploymentAutomationsWorkspace() {
  const { plans, loading, error, refresh, create, updateSchedule, execute, remove, listRuns } =
    useDeploymentAutomations();
  const { orgs } = useOrgs();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const orgAlias = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of orgs) map.set(org.id, org.alias);
    return map;
  }, [orgs]);

  const canSubmit =
    form.name.trim() &&
    form.sourceOrgId &&
    form.targetOrgId &&
    form.sourceOrgId !== form.targetOrgId &&
    form.packageXml.trim();

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setFormError(null);
    const payload: CreatePlanInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      sourceOrgId: form.sourceOrgId,
      targetOrgId: form.targetOrgId,
      packageXml: form.packageXml.trim(),
    };
    try {
      await create(payload);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  const scheduledCount = plans.filter((plan) => plan.scheduleEnabled).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Deployment automations"
        subtitle="Schedule saved deployment plans to run automatically, and review their run history."
        meta={
          plans.length
            ? `${plans.length} plan${plans.length === 1 ? '' : 's'} · ${scheduledCount} scheduled`
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
              New plan
            </Button>
          </>
        }
      />

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {showForm && (
        <GlassCard
          title="New metadata plan"
          description="Save a reusable org-to-org metadata deployment defined by a package.xml manifest."
        >
          <div className="space-y-4">
            {formError && (
              <InlineAlert variant="error" onDismiss={() => setFormError(null)}>
                {formError}
              </InlineAlert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="plan-name">Name</Label>
                <Input
                  id="plan-name"
                  value={form.name}
                  placeholder="Promote release to Prod"
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="plan-description">Description (optional)</Label>
                <Input
                  id="plan-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="plan-source">Source org</Label>
                <Select
                  id="plan-source"
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
                <Label htmlFor="plan-target">Target org</Label>
                <Select
                  id="plan-target"
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
            <div className="space-y-1">
              <Label htmlFor="plan-package">package.xml</Label>
              <Textarea
                id="plan-package"
                rows={7}
                className="font-mono text-xs"
                value={form.packageXml}
                placeholder={'<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n  <types>\n    <members>*</members>\n    <name>ApexClass</name>\n  </types>\n  <version>60.0</version>\n</Package>'}
                onChange={(event) => setForm({ ...form, packageXml: event.target.value })}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void submit()} loading={saving} disabled={!canSubmit}>
                Create plan
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {loading && !plans.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : plans.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarClock className="size-6" />
            </span>
            <div>
              <p className="font-medium">No deployment plans yet</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Create a plan to run a reusable org-to-org deployment on demand or on a schedule.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 size-4" />
              New plan
            </Button>
          </div>
        </GlassCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              orgAlias={orgAlias}
              onExecute={execute}
              onRemove={remove}
              onUpdateSchedule={updateSchedule}
              listRuns={listRuns}
            />
          ))}
        </div>
      )}
    </div>
  );
}
