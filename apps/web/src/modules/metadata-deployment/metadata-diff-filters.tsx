'use client';

import { cn } from '@/utils/cn';
import type { MetadataDiffType } from './types';
import type { MetadataCompareHook } from './use-metadata-compare';

const FILTERS: Array<{ id: MetadataDiffType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'changed', label: 'Changed' },
  { id: 'deleted', label: 'Deleted' },
];

export function MetadataDiffFilters({ w }: { w: MetadataCompareHook }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTERS.map((f) => {
        const count =
          f.id === 'all'
            ? w.summary?.total
            : w.summary?.[f.id as MetadataDiffType];
        const active = w.diffFilter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => { w.setDiffFilter(f.id); w.setPage(1); }}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors',
              active
                ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/25',
            )}
          >
            {f.label}
            {count !== undefined && <span className="ml-1 opacity-80">({count})</span>}
          </button>
        );
      })}
    </div>
  );
}
