'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import { CheckSquare, ListChecks, Search, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/utils/cn';

interface MetadataTypePickerProps {
  available: string[];
  selected: string[];
  common: string[];
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onToggle: (type: string) => void;
  onSelectCommon: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function MetadataTypePicker({
  available,
  selected,
  common,
  loading,
  error,
  disabled,
  onToggle,
  onSelectCommon,
  onSelectAll,
  onClear,
}: MetadataTypePickerProps) {
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const commonSet = useMemo(() => new Set(common), [common]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return available;
    return available.filter((type) => type.toLowerCase().includes(query));
  }, [available, search]);

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Metadata types to compare</p>
            <p className="text-xs text-muted-foreground">
              Only the types you select are compared — pick what you need instead of every type.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {selected.length} selected
        </span>
      </div>

      {disabled ? (
        <p className="mt-4 rounded-lg border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
          Select a source and target org to choose the metadata types to compare.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                placeholder="Search metadata types…"
                className="pl-9"
                aria-label="Search metadata types"
                disabled={loading && !available.length}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear metadata type search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={onSelectCommon} disabled={!common.length}>
                Common ({common.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={onSelectAll} disabled={!available.length}>
                All ({available.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={onClear} disabled={!selected.length}>
                Clear
              </Button>
            </div>
          </div>

          {error && <InlineAlert variant="warning">{error}</InlineAlert>}

          {loading && !available.length ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border/60 p-8 text-sm text-muted-foreground">
              <Spinner size="sm" /> Loading metadata types from both orgs…
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              {available.length
                ? `No metadata types match "${search}".`
                : 'No metadata types are available for these orgs.'}
            </p>
          ) : (
            <div className="max-h-64 overflow-auto rounded-lg border border-border/60 p-2">
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((type) => {
                  const isSelected = selectedSet.has(type);
                  return (
                    <li key={type}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                          isSelected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/40',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggle(type)}
                          aria-label={`Compare ${type}`}
                        />
                        <span className="min-w-0 flex-1 truncate">{type}</span>
                        {commonSet.has(type) && (
                          <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            common
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {selected.length ? (
                <CheckSquare className="size-3.5 text-primary" aria-hidden="true" />
              ) : (
                <Square className="size-3.5" aria-hidden="true" />
              )}
              {selected.length
                ? `${selected.length} of ${available.length} types will be compared`
                : 'Select at least one metadata type to run the comparison'}
            </span>
            {loading && available.length > 0 && (
              <span className="flex items-center gap-1.5"><Spinner size="sm" /> Refreshing type list…</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
