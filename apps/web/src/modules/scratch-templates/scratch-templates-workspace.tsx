'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Copy, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/studio';
import { api } from '@/services/api';
import { getSessionCache, hasFreshSessionCache, setSessionCache } from '@/lib/session-cache';
import { ScratchTemplateForm } from './scratch-template-form';
import { TemplatesPageHeader } from './templates-page-header';
import { configToSummaryChips, getSystemTemplatePresentation } from './types';
import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';
import { isRemovedSystemTemplateKey } from '@sfcc/shared';
import {
  insertAfterId,
  MutationAwareRequestGate,
  removeAtId,
  replaceOrInsertAfterId,
  restoreAtIndex,
} from '@/lib/optimistic-list';

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  systemKey?: string | null;
  sortOrder: number;
  updatedAt: string;
  config?: ScratchPipelineTemplateConfig;
  optimisticState?: 'duplicating';
}

export function ScratchTemplatesWorkspace() {
  const cacheKey = 'scratch-templates:list:v2';
  const cached = getSessionCache<TemplateRow[]>(cacheKey);
  const [templates, setTemplates] = useState<TemplateRow[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [mutationErrors, setMutationErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<TemplateRow | null>(null);
  const busyRef = useRef(new Set<string>());
  const tokensRef = useRef(new Map<string, number>());
  const templatesRef = useRef<TemplateRow[]>(cached ?? []);
  const requestGateRef = useRef(new MutationAwareRequestGate());

  const load = useCallback(async () => {
    const request = requestGateRef.current.beginRequest();
    if (!getSessionCache<TemplateRow[]>(cacheKey)) {
      setLoading(true);
    }
    try {
      const list = await api<TemplateRow[]>('/environment/scratch-templates');
      const visible = list.filter((template) => !isRemovedSystemTemplateKey(template.systemKey));
      if (!requestGateRef.current.isLatest(request) || busyRef.current.size > 0) return;
      templatesRef.current = visible;
      setTemplates(visible);
      setSessionCache(cacheKey, visible);
    } finally {
      if (requestGateRef.current.isLatestGeneration(request)) setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (hasFreshSessionCache(cacheKey)) return;
    void load();
  }, [cacheKey, load]);

  const duplicate = async (id: string) => {
    if (busyRef.current.size > 0) return;
    const source = templatesRef.current.find((template) => template.id === id);
    if (!source) return;
    const token = (tokensRef.current.get(id) ?? 0) + 1;
    tokensRef.current.set(id, token);
    busyRef.current.add(id);
    requestGateRef.current.beginMutation();
    setBusyIds((current) => ({ ...current, [id]: true }));
    setMutationErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    const provisionalId = `optimistic-template-${id}-${token}`;
    const provisional: TemplateRow = {
      ...source,
      id: provisionalId,
      name: `${source.name} (copy)`,
      isSystem: false,
      optimisticState: 'duplicating',
    };
    const pendingTemplates = insertAfterId(templatesRef.current, id, provisional);
    templatesRef.current = pendingTemplates;
    setTemplates(pendingTemplates);
    setAnnouncement(`${source.name} duplicate is being created.`);
    try {
      const created = await api<TemplateRow>(
        `/environment/scratch-templates/${encodeURIComponent(id)}/duplicate`,
        { method: 'POST' },
      );
      if (tokensRef.current.get(id) !== token) return;
      setTemplates((current) => {
        const next = replaceOrInsertAfterId(current, provisionalId, id, created);
        templatesRef.current = next;
        setSessionCache(cacheKey, next);
        return next;
      });
      setAnnouncement(`${created.name} created.`);
    } catch (error) {
      if (tokensRef.current.get(id) !== token) return;
      setTemplates((current) => {
        const next = current.filter((template) => template.id !== provisionalId);
        templatesRef.current = next;
        return next;
      });
      setMutationErrors((current) => ({
        ...current,
        [id]: error instanceof Error ? error.message : 'Template duplication failed',
      }));
      setAnnouncement(`${source.name} duplication failed; the pending row was removed.`);
    } finally {
      busyRef.current.delete(id);
      requestGateRef.current.finishMutation();
      setBusyIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  const remove = async (id: string) => {
    setConfirmDelete(null);
    if (busyRef.current.size > 0) return;
    const token = (tokensRef.current.get(id) ?? 0) + 1;
    tokensRef.current.set(id, token);
    busyRef.current.add(id);
    requestGateRef.current.beginMutation();
    setBusyIds((current) => ({ ...current, [id]: true }));
    setMutationErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    const removal = removeAtId(templatesRef.current, id);
    templatesRef.current = removal.items;
    setTemplates(removal.items);
    setAnnouncement(`${removal.snapshot?.item.name ?? 'Template'} is being deleted.`);
    try {
      await api(`/environment/scratch-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (tokensRef.current.get(id) !== token) return;
      setTemplates((current) => {
        const next = current.filter((template) => template.id !== id);
        templatesRef.current = next;
        setSessionCache(cacheKey, next);
        return next;
      });
      setAnnouncement(`${removal.snapshot?.item.name ?? 'Template'} deleted.`);
    } catch (error) {
      if (tokensRef.current.get(id) !== token) return;
      setTemplates((current) => {
        const next = restoreAtIndex(current, removal.snapshot);
        templatesRef.current = next;
        setSessionCache(cacheKey, next);
        return next;
      });
      setMutationErrors((current) => ({
        ...current,
        [id]: error instanceof Error ? error.message : 'Template deletion failed',
      }));
      setAnnouncement(`${removal.snapshot?.item.name ?? 'Template'} deletion failed and was rolled back.`);
    } finally {
      busyRef.current.delete(id);
      requestGateRef.current.finishMutation();
      setBusyIds((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  if (creating || editingId) {
    return (
      <ScratchTemplateForm
        templateId={editingId ?? undefined}
        onClose={() => {
          setCreating(false);
          setEditingId(null);
          void load();
        }}
      />
    );
  }

  const collectionBusy = Object.keys(busyIds).length > 0;
  const systemTemplates = templates.filter((template) => template.isSystem);
  const privateTemplates = templates.filter((template) => !template.isSystem);

  const renderTemplateCards = (rows: TemplateRow[]) => (
    <div className="grid gap-3">
      {rows.map((t) => {
        const presentation = getSystemTemplatePresentation(t.systemKey);
        return (
          <div
            key={t.id}
            className={[
              'rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4',
              t.isSystem
                ? 'border-violet-500/25 bg-gradient-to-r from-card/80 via-card/60 to-violet-500/5'
                : 'border-border/60 bg-card/50',
            ].join(' ')}
          >
            <div
              className="flex min-w-0 items-start gap-3"
              aria-busy={t.optimisticState === 'duplicating' || Boolean(busyIds[t.id])}
            >
              {t.isSystem && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-sm font-semibold text-violet-300">
                  {presentation?.number ?? t.sortOrder}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-medium">{t.name}</p>
                  {t.isSystem && (
                    <>
                      <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-300">
                        {presentation?.stage ?? 'Default stage'}
                      </span>
                      <span className="text-xs text-muted-foreground">Editable default</span>
                    </>
                  )}
                  {t.optimisticState === 'duplicating' && (
                    <span className="text-xs text-primary">Duplicating…</span>
                  )}
                </div>
                {presentation && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{presentation.summary}</p>
                )}
                {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
                {t.config && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {configToSummaryChips(t.config).map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
              {mutationErrors[t.id] && (
                <p role="alert" className="basis-full text-xs text-destructive">
                  {mutationErrors[t.id]} Changes were rolled back.
                </p>
              )}
              {t.optimisticState === 'duplicating' ? (
                <span className="text-xs text-muted-foreground">Waiting for the server…</span>
              ) : (
                <>
                  <Link
                    href={`/environment-center/create-scratch-org?templateId=${t.id}`}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-transparent px-3 text-sm font-medium hover:bg-accent"
                  >
                    Use in wizard
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={collectionBusy}
                    onClick={() => setEditingId(t.id)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={Boolean(busyIds[t.id])}
                    disabled={collectionBusy}
                    onClick={() => void duplicate(t.id)}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                  {!t.isSystem && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={Boolean(busyIds[t.id])}
                      disabled={collectionBusy}
                      onClick={() => setConfirmDelete(t)}
                    >
                      {!busyIds[t.id] && <Trash2 className="mr-1 h-3.5 w-3.5" />}
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <TemplatesPageHeader
        actions={
          <Button onClick={() => setCreating(true)} disabled={collectionBusy}>
            <Plus className="w-4 h-4 mr-2" />
            New template
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-7">
          <section aria-labelledby="default-template-heading" className="space-y-3">
            <div>
              <h2 id="default-template-heading" className="text-base font-semibold">
                Default pipeline templates
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Ordered by pipeline stage. Edit any default directly or duplicate it for a private variation.
              </p>
            </div>
            {renderTemplateCards(systemTemplates)}
          </section>

          {privateTemplates.length > 0 && (
            <section aria-labelledby="private-template-heading" className="space-y-3">
              <div>
                <h2 id="private-template-heading" className="text-base font-semibold">My templates</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Private presets created or duplicated for your own pipeline runs.
                </p>
              </div>
              {renderTemplateCards(privateTemplates)}
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete scratch org template?"
        message={`"${confirmDelete?.name ?? ''}" will be permanently removed. If deletion fails the template is restored automatically.`}
        confirmLabel="Delete template"
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        onConfirm={() => {
          if (confirmDelete) void remove(confirmDelete.id);
        }}
      />
    </div>
  );
}
