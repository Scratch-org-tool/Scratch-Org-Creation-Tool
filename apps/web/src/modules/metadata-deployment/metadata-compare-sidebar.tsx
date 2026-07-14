'use client';

import type { MetadataCompareHook } from './use-metadata-compare';

export function MetadataCompareSidebar({ w }: { w: MetadataCompareHook }) {
  const byType = w.summary?.byType ?? {};
  const types = Object.keys(byType).sort();

  return (
    <aside className="w-full md:w-52 shrink-0 border border-border/60 rounded-lg bg-card/40 p-2 space-y-1 max-h-[28rem] overflow-auto">
      <button
        type="button"
        className={`w-full text-left text-xs px-2 py-1.5 rounded ${!w.activeType ? 'bg-primary/10 font-medium' : 'hover:bg-muted'}`}
        onClick={() => { w.setActiveType(null); w.setPage(1); }}
      >
        All types
        {w.summary && <span className="text-muted-foreground ml-1">({w.summary.total})</span>}
      </button>
      {types.map((type) => {
        const counts = byType[type];
        const changed = counts.new + counts.changed + counts.deleted;
        return (
          <button
            key={type}
            type="button"
            className={`w-full text-left text-xs px-2 py-1.5 rounded flex justify-between gap-1 ${w.activeType === type ? 'bg-primary/10 font-medium' : 'hover:bg-muted'}`}
            onClick={() => { w.setActiveType(type); w.setPage(1); }}
          >
            <span className="truncate">{type}</span>
            <span className="text-muted-foreground shrink-0">{changed || counts.total}</span>
          </button>
        );
      })}
      {w.selectionCount > 0 && (
        <div className="text-[10px] text-primary font-medium px-2 pt-1 border-t border-border">
          {w.selectionCount} selected for deploy
        </div>
      )}
    </aside>
  );
}
