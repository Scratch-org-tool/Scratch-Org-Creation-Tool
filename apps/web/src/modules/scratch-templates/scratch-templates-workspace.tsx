'use client';

import { useCallback, useEffect, useState } from 'react';
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

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  updatedAt: string;
  config?: ScratchPipelineTemplateConfig;
}

export function ScratchTemplatesWorkspace() {
  const cacheKey = 'scratch-templates:list';
  const cached = getSessionCache<TemplateRow[]>(cacheKey);
  const [templates, setTemplates] = useState<TemplateRow[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!getSessionCache<TemplateRow[]>(cacheKey)) {
      setLoading(true);
    }
    try {
      const list = await api<TemplateRow[]>('/environment/scratch-templates');
      setTemplates(list);
      setSessionCache(cacheKey, list);
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (hasFreshSessionCache(cacheKey)) return;
    void load();
  }, [cacheKey, load]);

  const duplicate = async (id: string) => {
    await api(`/environment/scratch-templates/${id}/duplicate`, { method: 'POST' });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await api(`/environment/scratch-templates/${id}`, { method: 'DELETE' });
    await load();
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <TemplatesPageHeader
        actions={
          <Button onClick={() => setCreating(true)}>
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
            <div>
              <p className="font-medium">
                {t.name}
                {t.isSystem && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">System default</span>
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
              <Link
                href={`/environment-center/create-scratch-org?templateId=${t.id}`}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-border bg-transparent hover:bg-accent"
              >
                Use in wizard
              </Link>
              <Button size="sm" variant="outline" onClick={() => void duplicate(t.id)}>
                <Copy className="w-3.5 h-3.5 mr-1" />
                Duplicate
              </Button>
              {!t.isSystem && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(t.id)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void remove(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
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
