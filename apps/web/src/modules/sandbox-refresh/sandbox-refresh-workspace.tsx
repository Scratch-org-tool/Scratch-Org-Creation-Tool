'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  DatabaseZap,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ConfirmDialog,
  GlassCard,
  InlineAlert,
  PageHeader,
  StatusBadge,
  relativeTime,
} from '@/components/studio';
import { useOrgs } from '@/hooks/use-orgs';
import { api } from '@/services/api';

interface SandboxRefreshRecord {
  id: string;
  orgConnectionId: string;
  orgAlias: string | null;
  sandboxName: string;
  status: string;
  notes: string | null;
  cadenceDays: number | null;
  nextRefreshDueAt: string | null;
  overdue: boolean;
  postRefreshConfig: Record<string, unknown> | null;
  requestedAt: string;
  completedAt: string | null;
}

interface FormState {
  orgConnectionId: string;
  sandboxName: string;
  mode: 'track' | 'trigger';
  cadenceDays: string;
  notes: string;
  seedEnabled: boolean;
  seedSourceOrgId: string;
  seedTargetOrgId: string;
}

const EMPTY_FORM: FormState = {
  orgConnectionId: '',
  sandboxName: '',
  mode: 'track',
  cadenceDays: '',
  notes: '',
  seedEnabled: false,
  seedSourceOrgId: '',
  seedTargetOrgId: '',
};

export function SandboxRefreshWorkspace() {
  const { orgs } = useOrgs();
  const [records, setRecords] = useState<SandboxRefreshRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<{ id: string; action: 'complete' | 'delete' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SandboxRefreshRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await api<SandboxRefreshRecord[]>('/sandbox-refresh'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sandbox refreshes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api('/sandbox-refresh', {
        method: 'POST',
        body: JSON.stringify({
          orgConnectionId: form.orgConnectionId,
          sandboxName: form.sandboxName.trim(),
          mode: form.mode,
          notes: form.notes.trim() || undefined,
          cadenceDays: form.cadenceDays ? Number(form.cadenceDays) : undefined,
          ...(form.seedEnabled && form.seedSourceOrgId && form.seedTargetOrgId
            ? {
                postRefreshConfig: {
                  dataSeed: {
                    sourceOrgId: form.seedSourceOrgId,
                    targetOrgId: form.seedTargetOrgId,
                  },
                },
              }
            : {}),
        }),
      });
      setNotice(form.mode === 'trigger'
        ? 'Refresh requested — Salesforce completes it in the background. Mark it complete once the sandbox is back.'
        : 'Refresh tracked. Mark it complete when the sandbox is ready.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create refresh');
    } finally {
      setSaving(false);
    }
  };

  const complete = async (record: SandboxRefreshRecord) => {
    setBusy({ id: record.id, action: 'complete' });
    setError(null);
    try {
      await api(`/sandbox-refresh/${record.id}/complete`, { method: 'POST' });
      setNotice(`Sandbox ${record.sandboxName} marked complete.${record.postRefreshConfig ? ' Post-refresh automation queued.' : ''}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete refresh');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (record: SandboxRefreshRecord) => {
    setBusy({ id: record.id, action: 'delete' });
    try {
      await api(`/sandbox-refresh/${record.id}`, { method: 'DELETE' });
      setRecords((current) => current.filter((row) => row.id !== record.id));
      setConfirmDelete(null);
    } catch (err) {
      setConfirmDelete(null);
      setError(err instanceof Error ? err.message : 'Failed to delete record');
    } finally {
      setBusy(null);
    }
  };

  const dueSoon = records.filter((row) => row.overdue && row.status === 'completed');

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        title="Sandbox Refresh"
        subtitle="Track refresh cycles, trigger refreshes via the Salesforce CLI, and re-run seed automation after each refresh."
        showBreadcrumbs={false}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>
              {!loading && <RefreshCw aria-hidden />}
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm((current) => !current)}>
              <Plus aria-hidden />
              New refresh
            </Button>
          </>
        )}
      />

      {error && <InlineAlert variant="error" onDismiss={() => setError(null)}>{error}</InlineAlert>}
      {notice && <InlineAlert variant="success" onDismiss={() => setNotice(null)}>{notice}</InlineAlert>}
      {dueSoon.length > 0 && (
        <InlineAlert variant="warning">
          {dueSoon.length} sandbox{dueSoon.length === 1 ? ' is' : 'es are'} past the refresh cadence:{' '}
          {dueSoon.map((row) => row.sandboxName).join(', ')}.
        </InlineAlert>
      )}

      {showForm && (
        <GlassCard
          title="New sandbox refresh"
          description="Trigger runs `sf org refresh sandbox` against the production org (asynchronous on Salesforce's side); Track just records a refresh managed elsewhere."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="refresh-org">Production org</Label>
              <Select
                id="refresh-org"
                value={form.orgConnectionId}
                onChange={(event) => setForm((c) => ({ ...c, orgConnectionId: event.target.value }))}
              >
                <option value="">Select…</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.alias}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="refresh-name">Sandbox name</Label>
              <Input
                id="refresh-name"
                value={form.sandboxName}
                maxLength={80}
                onChange={(event) => setForm((c) => ({ ...c, sandboxName: event.target.value }))}
                placeholder="UAT"
              />
            </div>
            <div>
              <Label htmlFor="refresh-mode">Mode</Label>
              <Select
                id="refresh-mode"
                value={form.mode}
                onChange={(event) => setForm((c) => ({ ...c, mode: event.target.value as FormState['mode'] }))}
              >
                <option value="track">Track only (refresh managed in Salesforce Setup)</option>
                <option value="trigger">Trigger via Salesforce CLI now</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="refresh-cadence">Refresh cadence (days, optional)</Label>
              <Input
                id="refresh-cadence"
                type="number"
                min={1}
                max={365}
                value={form.cadenceDays}
                onChange={(event) => setForm((c) => ({ ...c, cadenceDays: event.target.value }))}
                placeholder="30"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="refresh-notes">Notes</Label>
              <Input
                id="refresh-notes"
                value={form.notes}
                maxLength={1000}
                onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))}
                placeholder="Why / what changes after this refresh?"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <DatabaseZap className="size-4 text-primary" aria-hidden />
                  Post-refresh data seed
                </p>
                <p className="text-xs text-muted-foreground">
                  When the refresh is marked complete, automatically queue a data seed into the refreshed sandbox.
                </p>
              </div>
              <Switch
                checked={form.seedEnabled}
                onChange={(next) => setForm((c) => ({ ...c, seedEnabled: next }))}
                aria-label="Enable post-refresh data seed"
              />
            </div>
            {form.seedEnabled && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="seed-source">Seed source org</Label>
                  <Select
                    id="seed-source"
                    value={form.seedSourceOrgId}
                    onChange={(event) => setForm((c) => ({ ...c, seedSourceOrgId: event.target.value }))}
                  >
                    <option value="">Select…</option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>{org.alias}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="seed-target">Seed target org (the refreshed sandbox connection)</Label>
                  <Select
                    id="seed-target"
                    value={form.seedTargetOrgId}
                    onChange={(event) => setForm((c) => ({ ...c, seedTargetOrgId: event.target.value }))}
                  >
                    <option value="">Select…</option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>{org.alias}</option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void create()}
              loading={saving}
              disabled={!form.orgConnectionId || !form.sandboxName.trim()
                || (form.seedEnabled && (!form.seedSourceOrgId || !form.seedTargetOrgId))}
            >
              {form.mode === 'trigger' ? 'Trigger refresh' : 'Track refresh'}
            </Button>
          </div>
        </GlassCard>
      )}

      <GlassCard title="Refresh history" description="Cadence reminders show on the Environment Calendar too.">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : records.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sandbox refreshes tracked yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {records.map((record) => (
              <li
                key={record.id}
                className="flex flex-col gap-2 rounded-lg border border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{record.sandboxName}</span>
                    <StatusBadge status={record.status === 'refreshing' ? 'running' : record.status} />
                    {record.overdue && record.status === 'completed' && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-400">
                        refresh due
                      </span>
                    )}
                    {record.postRefreshConfig && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        auto-seed
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {record.orgAlias ?? record.orgConnectionId.slice(0, 8)} · requested {relativeTime(record.requestedAt)}
                    {record.completedAt ? ` · completed ${relativeTime(record.completedAt)}` : ''}
                    {record.cadenceDays ? ` · every ${record.cadenceDays}d` : ''}
                    {record.nextRefreshDueAt ? ` · next due ${relativeTime(record.nextRefreshDueAt)}` : ''}
                  </p>
                  {record.notes && (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground/80">{record.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {record.status !== 'completed' && (
                    <Button
                      size="sm"
                      onClick={() => void complete(record)}
                      loading={busy?.id === record.id && busy.action === 'complete'}
                      disabled={busy?.id === record.id}
                    >
                      {!(busy?.id === record.id && busy.action === 'complete') && (
                        <CheckCircle2 aria-hidden />
                      )}
                      Mark complete
                    </Button>
                  )}
                  {record.status === 'completed' && record.overdue && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setForm({
                          ...EMPTY_FORM,
                          orgConnectionId: record.orgConnectionId,
                          sandboxName: record.sandboxName,
                          cadenceDays: record.cadenceDays ? String(record.cadenceDays) : '',
                        });
                        setShowForm(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <RotateCcw aria-hidden />
                      Refresh again
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDelete(record)}
                    loading={busy?.id === record.id && busy.action === 'delete'}
                    disabled={busy?.id === record.id}
                    aria-label={`Delete ${record.sandboxName} record`}
                  >
                    {!(busy?.id === record.id && busy.action === 'delete') && <Trash2 aria-hidden />}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete refresh record?"
        message={`The tracking record for "${confirmDelete?.sandboxName ?? ''}" will be removed. This does not affect the sandbox itself.`}
        confirmLabel="Delete record"
        loading={busy?.action === 'delete'}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        onConfirm={() => {
          if (confirmDelete) void remove(confirmDelete);
        }}
      />
    </div>
  );
}
