'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/studio';
import { itemKey } from './types';
import type { MetadataCompareHook } from './use-metadata-compare';

export function MetadataProblemAnalysis({ w }: { w: MetadataCompareHook }) {
  const [tab, setTab] = useState<'summary' | 'fixes' | 'warnings'>('summary');
  const analysis = w.analysis;

  if (!analysis) {
    return (
      <>
        <p className="text-sm text-muted-foreground mb-3">
          Analyze {w.selectionCount} selected item(s) for deployment issues before proceeding.
        </p>
        <Button onClick={() => void w.runAnalysis()} loading={w.analysisLoading} disabled={w.selectionCount === 0}>
          Run analysis
        </Button>
      </>
    );
  }

  const tabs = [
    { id: 'summary' as const, label: 'Summary' },
    { id: 'fixes' as const, label: `Suggested fixes (${analysis.suggestedFixes.length})` },
    { id: 'warnings' as const, label: `Warnings (${analysis.warnings.length})` },
  ];

  return (
    <>
      <div className="flex gap-1 mb-4 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`text-xs px-2 py-1 rounded ${tab === t.id ? 'bg-primary/10 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
          <Stat label="Selected" value={analysis.summary.totalSelected} />
          <Stat label="Deployable" value={analysis.summary.deployable} />
          <Stat label="Errors" value={analysis.summary.errors} variant={analysis.summary.errors ? 'error' : undefined} />
          <Stat label="Warnings" value={analysis.summary.warnings} variant={analysis.summary.warnings ? 'warning' : undefined} />
        </div>
      )}

      {tab === 'fixes' && (
        <div className="space-y-3">
          {analysis.suggestedFixes.length === 0 && (
            <p className="text-sm text-muted-foreground">No blocking issues found.</p>
          )}
          {analysis.suggestedFixes.map((fix) => (
            <InlineAlert key={fix.id} variant={fix.severity === 'error' ? 'error' : 'warning'}>
              <p className="font-medium text-xs">{fix.title}</p>
              <p className="text-xs mt-1 opacity-90">{fix.description}</p>
              <p className="text-[10px] mt-1 text-muted-foreground">{fix.suggestedAction}</p>
              {fix.autoExclude && (
                <label className="flex items-center gap-2 mt-2 text-xs">
                  <input
                    type="checkbox"
                    checked={fix.affectedItems.every((a) => w.excludedKeys.has(itemKey(a.metadataType, a.fullName)))}
                    onChange={(e) => {
                      const next = new Set(w.excludedKeys);
                      for (const a of fix.affectedItems) {
                        const k = itemKey(a.metadataType, a.fullName);
                        if (e.target.checked) next.add(k);
                        else next.delete(k);
                      }
                      w.setExcludedKeys(next);
                    }}
                  />
                  Exclude affected items ({fix.affectedItems.length})
                </label>
              )}
            </InlineAlert>
          ))}
        </div>
      )}

      {tab === 'warnings' && (
        <div className="space-y-3">
          {analysis.warnings.length === 0 && (
            <p className="text-sm text-muted-foreground">No warnings.</p>
          )}
          {analysis.warnings.map((warn) => (
            <InlineAlert key={warn.id} variant="warning">
              <p className="font-medium text-xs">{warn.title}</p>
              <p className="text-xs mt-1">{warn.description}</p>
            </InlineAlert>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, variant }: { label: string; value: number; variant?: 'error' | 'warning' }) {
  const color = variant === 'error' ? 'text-destructive' : variant === 'warning' ? 'text-amber-600' : '';
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
