'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react';
import {
  RELEASE_STATUS_LABELS,
  type ReleaseRecord,
  type ReleaseStatus,
} from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DeploymentPageHeader,
  GlassCard,
  InlineAlert,
  StatusBadge,
  relativeTime,
} from '@/components/studio';
import { useAuth } from '@/contexts/auth-context';
import { useOrgs } from '@/hooks/use-orgs';
import { api } from '@/services/api';
import { useReleaseDetail, useReleases } from './use-releases';

const STATUS_BADGE: Record<ReleaseStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-300',
  in_review: 'bg-blue-500/15 text-blue-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  released: 'bg-violet-500/15 text-violet-400',
  cancelled: 'bg-red-500/15 text-red-400',
};

interface DeploymentOption {
  id: string;
  repo: string;
  branch: string;
  status: string;
}

export function ReleasesWorkspace() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { orgs } = useOrgs();
  const { releases, loading, error, refresh, create } = useReleases();

  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const detail = useReleaseDetail(selectedId);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', version: '', description: '', targetOrgId: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showAddItem, setShowAddItem] = useState(false);
  const [itemKind, setItemKind] = useState<'deployment' | 'work_item'>('deployment');
  const [deployments, setDeployments] = useState<DeploymentOption[]>([]);
  const [itemForm, setItemForm] = useState({
    deploymentId: '',
    provider: 'azure_boards',
    projectId: '',
    externalId: '',
    title: '',
  });

  useEffect(() => {
    if (!showAddItem || deployments.length > 0) return;
    api<DeploymentOption[]>('/deployments')
      .then(setDeployments)
      .catch(() => setDeployments([]));
  }, [showAddItem, deployments.length]);

  const isAdmin = profile?.role === 'admin';
  const release = detail.release;
  const isOwner = release ? release.createdBy === profile?.id : false;
  const canManage = isAdmin || isOwner;

  const grouped = useMemo(() => {
    const active = releases.filter((row) => row.status !== 'released' && row.status !== 'cancelled');
    const done = releases.filter((row) => row.status === 'released' || row.status === 'cancelled');
    return { active, done };
  }, [releases]);

  const submitCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await create({
        name: createForm.name.trim(),
        version: createForm.version.trim(),
        description: createForm.description.trim() || undefined,
        targetOrgId: createForm.targetOrgId || undefined,
      });
      setShowCreate(false);
      setCreateForm({ name: '', version: '', description: '', targetOrgId: '' });
      setSelectedId(created.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create release');
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (
    name: 'submit' | 'approve' | 'reject' | 'release' | 'reopen' | 'cancel' | 'generate-notes',
  ) => {
    setActionBusy(name);
    setActionError(null);
    try {
      await detail.action(name);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${name} release`);
    } finally {
      setActionBusy(null);
    }
  };

  const submitAddItem = async () => {
    setActionBusy('add-item');
    setActionError(null);
    try {
      if (itemKind === 'deployment') {
        await detail.addItem({ kind: 'deployment', deploymentId: itemForm.deploymentId });
      } else {
        await detail.addItem({
          kind: 'work_item',
          provider: itemForm.provider,
          projectId: itemForm.projectId.trim(),
          externalId: itemForm.externalId.trim(),
          title: itemForm.title.trim() || undefined,
        });
      }
      setShowAddItem(false);
      setItemForm({ deploymentId: '', provider: 'azure_boards', projectId: '', externalId: '', title: '' });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setActionBusy(null);
    }
  };

  const renderReleaseRow = (row: ReleaseRecord) => (
    <li key={row.id}>
      <button
        type="button"
        onClick={() => setSelectedId(row.id)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
          selectedId === row.id
            ? 'border-primary/50 bg-primary/10'
            : 'border-border/60 hover:border-primary/30 hover:bg-secondary/40'
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {row.name} <span className="text-muted-foreground">v{row.version}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.itemCount ?? 0} item{(row.itemCount ?? 0) === 1 ? '' : 's'}
            {row.targetOrgAlias ? ` · ${row.targetOrgAlias}` : ''}
            {` · updated ${relativeTime(row.updatedAt)}`}
          </p>
        </div>
        <StatusBadge
          status={row.status}
          label={RELEASE_STATUS_LABELS[row.status]}
          className={STATUS_BADGE[row.status]}
        />
      </button>
    </li>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DeploymentPageHeader
        title="Releases"
        subtitle="Group deployments and work items into versioned releases with approvals and release notes."
        icon={Package}
        accentClass="to-violet-500/10"
        showBreadcrumbs
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate((current) => !current)}>
              <Plus aria-hidden />
              New release
            </Button>
          </>
        )}
      />

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {showCreate && (
        <GlassCard title="New release" description="Name + version must be unique together.">
          {createError && (
            <div className="mb-3">
              <InlineAlert variant="error" onDismiss={() => setCreateError(null)}>{createError}</InlineAlert>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="release-name">Name</Label>
              <Input
                id="release-name"
                value={createForm.name}
                maxLength={120}
                onChange={(event) => setCreateForm((c) => ({ ...c, name: event.target.value }))}
                placeholder="Summer Release"
              />
            </div>
            <div>
              <Label htmlFor="release-version">Version</Label>
              <Input
                id="release-version"
                value={createForm.version}
                maxLength={40}
                onChange={(event) => setCreateForm((c) => ({ ...c, version: event.target.value }))}
                placeholder="2026.07.1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="release-description">Description</Label>
              <Textarea
                id="release-description"
                value={createForm.description}
                maxLength={2000}
                onChange={(event) => setCreateForm((c) => ({ ...c, description: event.target.value }))}
                placeholder="What ships in this release?"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="release-target">Target org (optional)</Label>
              <Select
                id="release-target"
                value={createForm.targetOrgId}
                onChange={(event) => setCreateForm((c) => ({ ...c, targetOrgId: event.target.value }))}
              >
                <option value="">None</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.alias}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void submitCreate()}
              loading={creating}
              disabled={!createForm.name.trim() || !createForm.version.trim()}
            >
              Create release
            </Button>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,1fr)_2fr] items-start">
        <GlassCard title="All releases" description={`${releases.length} total`}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ) : releases.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No releases yet. Create one to start grouping deployments and work items.
            </p>
          ) : (
            <div className="space-y-4">
              {grouped.active.length > 0 && (
                <ul className="space-y-1.5">{grouped.active.map(renderReleaseRow)}</ul>
              )}
              {grouped.done.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Shipped / cancelled
                  </p>
                  <ul className="space-y-1.5">{grouped.done.map(renderReleaseRow)}</ul>
                </div>
              )}
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          {!selectedId && (
            <GlassCard title="Release detail">
              <p className="py-10 text-center text-sm text-muted-foreground">
                Select a release to view its contents, approvals, and notes.
              </p>
            </GlassCard>
          )}

          {selectedId && detail.loading && <Skeleton className="h-[320px] rounded-xl" />}
          {selectedId && detail.error && <InlineAlert variant="error">{detail.error}</InlineAlert>}

          {release && !detail.loading && (
            <>
              <GlassCard
                title={(
                  <span className="flex items-center gap-2 text-base font-semibold">
                    {release.name} <span className="text-muted-foreground">v{release.version}</span>
                    <StatusBadge
                      status={release.status}
                      label={RELEASE_STATUS_LABELS[release.status]}
                      className={STATUS_BADGE[release.status]}
                    />
                  </span>
                )}
                description={release.description ?? undefined}
              >
                {actionError && (
                  <div className="mb-3">
                    <InlineAlert variant="error" onDismiss={() => setActionError(null)}>
                      {actionError}
                    </InlineAlert>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {release.status === 'draft' && canManage && (
                    <Button size="sm" onClick={() => void runAction('submit')} loading={actionBusy === 'submit'}>
                      <Rocket aria-hidden />
                      Submit for review
                    </Button>
                  )}
                  {release.status === 'in_review' && !isOwner && (
                    <>
                      <Button size="sm" onClick={() => void runAction('approve')} loading={actionBusy === 'approve'}>
                        <CheckCircle2 aria-hidden />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction('reject')} loading={actionBusy === 'reject'}>
                        <XCircle aria-hidden />
                        Reject
                      </Button>
                    </>
                  )}
                  {release.status === 'approved' && canManage && (
                    <Button size="sm" onClick={() => void runAction('release')} loading={actionBusy === 'release'}>
                      <Rocket aria-hidden />
                      Mark released
                    </Button>
                  )}
                  {(release.status === 'in_review' || release.status === 'approved') && canManage && (
                    <Button size="sm" variant="ghost" onClick={() => void runAction('reopen')} loading={actionBusy === 'reopen'}>
                      <Undo2 aria-hidden />
                      Back to draft
                    </Button>
                  )}
                  {release.status !== 'released' && release.status !== 'cancelled' && canManage && (
                    <Button size="sm" variant="ghost" onClick={() => void runAction('cancel')} loading={actionBusy === 'cancel'}>
                      Cancel release
                    </Button>
                  )}
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Target org</dt>
                    <dd className="mt-0.5">{release.targetOrgAlias ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Created</dt>
                    <dd className="mt-0.5">{relativeTime(release.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Released</dt>
                    <dd className="mt-0.5">{release.releasedAt ? relativeTime(release.releasedAt) : '—'}</dd>
                  </div>
                </dl>
              </GlassCard>

              <GlassCard
                title="Contents"
                description="Deployments and work items shipping in this release."
                headerAction={release.status === 'draft' && canManage ? (
                  <Button size="sm" variant="outline" onClick={() => setShowAddItem((current) => !current)}>
                    <Plus aria-hidden />
                    Add item
                  </Button>
                ) : undefined}
              >
                {showAddItem && (
                  <div className="mb-4 space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={itemKind === 'deployment' ? 'default' : 'outline'}
                        onClick={() => setItemKind('deployment')}
                      >
                        Deployment
                      </Button>
                      <Button
                        size="sm"
                        variant={itemKind === 'work_item' ? 'default' : 'outline'}
                        onClick={() => setItemKind('work_item')}
                      >
                        Work item
                      </Button>
                    </div>
                    {itemKind === 'deployment' ? (
                      <div>
                        <Label htmlFor="item-deployment">Deployment</Label>
                        <Select
                          id="item-deployment"
                          value={itemForm.deploymentId}
                          onChange={(event) => setItemForm((c) => ({ ...c, deploymentId: event.target.value }))}
                        >
                          <option value="">Select…</option>
                          {deployments.map((dep) => (
                            <option key={dep.id} value={dep.id}>
                              {dep.repo}/{dep.branch} — {dep.status}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="item-provider">Provider</Label>
                          <Select
                            id="item-provider"
                            value={itemForm.provider}
                            onChange={(event) => setItemForm((c) => ({ ...c, provider: event.target.value }))}
                          >
                            <option value="azure_boards">Azure Boards</option>
                            <option value="github_issues">GitHub Issues</option>
                            <option value="jira">Jira</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="item-project">Project</Label>
                          <Input
                            id="item-project"
                            value={itemForm.projectId}
                            onChange={(event) => setItemForm((c) => ({ ...c, projectId: event.target.value }))}
                            placeholder="Project name or key"
                          />
                        </div>
                        <div>
                          <Label htmlFor="item-id">Work item ID</Label>
                          <Input
                            id="item-id"
                            value={itemForm.externalId}
                            onChange={(event) => setItemForm((c) => ({ ...c, externalId: event.target.value }))}
                            placeholder="42"
                          />
                        </div>
                        <div>
                          <Label htmlFor="item-title">Title (optional)</Label>
                          <Input
                            id="item-title"
                            value={itemForm.title}
                            onChange={(event) => setItemForm((c) => ({ ...c, title: event.target.value }))}
                            placeholder="Fix login bug"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowAddItem(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void submitAddItem()}
                        loading={actionBusy === 'add-item'}
                        disabled={itemKind === 'deployment'
                          ? !itemForm.deploymentId
                          : !itemForm.projectId.trim() || !itemForm.externalId.trim()}
                      >
                        Add to release
                      </Button>
                    </div>
                  </div>
                )}

                {(release.items ?? []).length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nothing linked yet. Add a deployment or work item.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {(release.items ?? []).map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {item.kind === 'deployment' ? 'Deployment' : 'Work item'} — {item.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.kind === 'deployment'
                              ? `${item.deployment?.status ?? 'unknown'}${item.deployment?.targetOrgAlias ? ` · ${item.deployment.targetOrgAlias}` : ''}`
                              : `${item.workItemProvider} · ${item.workItemProjectId}#${item.workItemExternalId}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {item.kind === 'deployment' && item.deployment && (
                            <StatusBadge status={item.deployment.status} />
                          )}
                          {release.status === 'draft' && canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void detail.removeItem(item.id)}
                              aria-label={`Remove ${item.title}`}
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>

              <GlassCard
                title={(
                  <span className="flex items-center gap-2 text-base font-semibold">
                    <FileText className="size-4 text-primary" aria-hidden />
                    Release notes
                  </span>
                )}
                description={release.notesGeneratedAt
                  ? `Generated ${relativeTime(release.notesGeneratedAt)}`
                  : 'Generate markdown notes from the linked items.'}
                headerAction={canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runAction('generate-notes')}
                    loading={actionBusy === 'generate-notes'}
                  >
                    <Sparkles aria-hidden />
                    Generate
                  </Button>
                ) : undefined}
              >
                {release.releaseNotes ? (
                  <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/30 p-4 text-sm leading-relaxed">
                    {release.releaseNotes}
                  </pre>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No notes yet.
                  </p>
                )}
              </GlassCard>

              {(release.approvals ?? []).length > 0 && (
                <GlassCard title="Review trail">
                  <ul className="space-y-1.5">
                    {(release.approvals ?? []).map((approval) => (
                      <li
                        key={approval.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {approval.actorName ?? approval.actorId}
                          {approval.comment ? ` — “${approval.comment}”` : ''}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge
                            status={approval.decision === 'approved' ? 'completed' : 'failed'}
                            label={approval.decision}
                          />
                          {relativeTime(approval.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
