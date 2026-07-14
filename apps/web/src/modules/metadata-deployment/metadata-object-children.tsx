'use client';

import type { MetadataCompareHook } from './use-metadata-compare';

export function MetadataObjectChildren({ w }: { w: MetadataCompareHook }) {
  if (!w.selectedItem || w.selectedItem.metadataType !== 'CustomObject') return null;
  if (w.childrenLoading) {
    return (
      <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
        Loading dependent metadata…
      </div>
    );
  }
  if (!w.children.length) return null;

  return (
    <div className="px-3 py-2 border-t border-border bg-muted/20">
      <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
        Depends on — {w.selectedItem.fullName}
      </p>
      <div className="flex flex-wrap gap-2">
        {w.children.map((c) => (
          <span key={c.type} className="text-[10px] px-2 py-0.5 rounded bg-background border border-border">
            {c.type} <span className="text-muted-foreground">({c.count})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
