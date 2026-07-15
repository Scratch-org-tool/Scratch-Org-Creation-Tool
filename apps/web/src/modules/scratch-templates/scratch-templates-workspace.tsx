'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Copy, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';
import { getSessionCache, hasFreshSessionCache, setSessionCache } from '@/lib/session-cache';
import { ScratchTemplateForm } from './scratch-template-form';
import { TemplatesPageHeader } from './templates-page-header';
import { configToSummaryChips } from './types';
import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';
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
  updatedAt: string;
  config?: ScratchPipelineTemplateConfig;
  optimisticState?: 'duplicating';
}

export function ScratchTemplatesWorkspace() {
  const cacheKey = 'scratch-templates:list';
  const cached = getSessionCache<TemplateRow[]>(cacheKey);
  const [templates, setTemplates] = useState<TemplateRow[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [mutationErrors, setMutationErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState('');
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
      if (!requestGateRef.current.isLatest(request) || busyRef.current.size > 0) return;
      templatesRef.current = list;
      setTemplates(list);
      setSessionCache(cacheKey, list);
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
    if (!confirm('Delete this template?')) return;
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
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
      <div className="grid gap-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border border-border/60 bg-card/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div aria-busy={t.optimisticState === 'duplicating' || Boolean(busyIds[t.id])}>
              <p className="font-medium">
                {t.name}
                {t.isSystem && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">System default</span>
                )}
                {t.optimisticState === 'duplicating' && (
                  <span className="ml-2 text-xs text-primary font-normal">Duplicating…</span>
                )}
              </p>
              {t.description && <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>}
              {t.config && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {configToSummaryChips(t.config).map((chip) => (
                    <span
                      key={chip}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
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
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-border bg-transparent hover:bg-accent"
                  >
                    Use in wizard
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={Boolean(busyIds[t.id])}
                    disabled={collectionBusy}
                    onClick={() => void duplicate(t.id)}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Duplicate
                  </Button>
                  {!t.isSystem && (
                    <>
                      <Button size="sm" variant="outline" disabled={collectionBusy} onClick={() => setEditingId(t.id)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" disabled={collectionBusy} onClick={() => void remove(t.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
