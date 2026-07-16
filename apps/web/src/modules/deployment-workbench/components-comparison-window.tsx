'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Eye,
  Filter,
  GitCompare,
  ListTree,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import { cn } from '@/utils/cn';
import { api } from '@/services/api';
import { MetadataXmlDiffViewer } from '@/modules/metadata-deployment/metadata-item-diff-panel';
import type {
  CompareDiffType,
  CompareFilters,
  CompareItem,
  CompareItemDiff,
  CompareRelatedChildren,
  CompareSummary,
  CompareTypeSummary,
} from './types';
import {
  buildCompareKey,
  compareTypeSummaries,
  filterCompareItems,
} from './workbench-utils';

const DIFF_ORDER: CompareDiffType[] = ['new', 'changed', 'deleted', 'same', 'unknown'];

const DIFF_CONFIG: Record<CompareDiffType, { label: string; chip: string; color: string; icon?: React.ReactNode }> = {
  new: {
    label: 'New',
    chip: 'New',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  changed: {
    label: 'Changed',
    chip: 'Changed',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  deleted: {
    label: 'Deleted',
    chip: 'Deleted',
    color: 'bg-red-500/15 text-red-300 border-red-500/30',
  },
  same: {
    label: 'No difference',
    chip: 'No difference',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  },
  unknown: {
    label: 'Not inspected',
    chip: 'Not inspected',
    color: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  },
};

const EXACT_OBJECT_CHILD_TYPES = new Set([
  'AssignmentRules',
  'AutoResponseRules',
  'EscalationRules',
  'MatchingRules',
  'SharingRules',
  'Workflow',
]);

function isObjectChild(item: CompareItem, objectName: string): boolean {
  if (EXACT_OBJECT_CHILD_TYPES.has(item.metadataType)) return item.fullName === objectName;
  if (item.metadataType === 'Layout') {
    return item.fullName === objectName
      || item.fullName.startsWith(`${objectName}-`)
      || item.fullName.startsWith(`${objectName}.`);
  }
  return item.fullName.startsWith(`${objectName}.`);
}

interface ComponentsComparisonWindowProps {
  comparisonId: string | undefined;
  comparisonStatus: string;
  comparisonSummary: CompareSummary | null;
  items: CompareItem[];
  selectedKeys: Set<string>;
  comparing: boolean;
  selectedItem: CompareItem | null;
  itemDiff: CompareItemDiff | null;
  itemDiffLoading: boolean;
  itemDiffError: string | null;
  sourceLabel: string;
  targetLabel: string;
  onRetryComparison: () => void;
  onToggleItem: (item: CompareItem) => void;
  onSelectItems: (items: CompareItem[], selected: boolean) => void;
  onSelectItem: (item: CompareItem) => void;
}

export function ComponentsComparisonWindow(props: ComponentsComparisonWindowProps) {
  const {
    comparisonId,
    comparisonStatus,
    comparisonSummary,
    items,
    selectedKeys,
    comparing,
    selectedItem,
    itemDiff,
    itemDiffLoading,
    itemDiffError,
    sourceLabel,
    targetLabel,
    onRetryComparison,
    onToggleItem,
    onSelectItems,
    onSelectItem,
  } = props;

  const [filters, setFilters] = useState<CompareFilters>({
    metadataType: '',
    diffTypes: [...DIFF_ORDER],
    search: '',
    selectedOnly: false,
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [relatedChildren, setRelatedChildren] = useState<CompareRelatedChildren | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const didAutoSelectType = useRef(false);

  const pageSize = 100;
  const typeSummaries = useMemo(() => compareTypeSummaries(items), [items]);

  const filteredItems = useMemo(
    () => {
      const matching = filterCompareItems(items, {
        metadataType: filters.metadataType,
        diffTypes: filters.diffTypes,
        search: filters.search,
      });
      return filters.selectedOnly
        ? matching.filter((item) => selectedKeys.has(buildCompareKey(item.metadataType, item.fullName)))
        : matching;
    },
    [items, filters, selectedKeys],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredItems.length / pageSize)),
    [filteredItems.length],
  );

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.metadataType, filters.diffTypes, filters.search, filters.selectedOnly]);

  // A new comparison clears any earlier auto-selection so the system can default
  // the metadata type again for the fresh source/target pair.
  useEffect(() => {
    didAutoSelectType.current = false;
    setFilters({ metadataType: '', diffTypes: [...DIFF_ORDER], search: '', selectedOnly: false });
  }, [comparisonId]);

  // Default the metadata type from the system: once the comparison surfaces real
  // differences, focus the type with the most changes so the user immediately
  // sees components and their source-vs-target diff instead of a flat list.
  useEffect(() => {
    if (didAutoSelectType.current || filters.metadataType) return;
    const changedTypes = typeSummaries.filter(
      (type) => type.new + type.changed + type.deleted > 0,
    );
    if (!changedTypes.length) return;
    const best = [...changedTypes].sort((left, right) => {
      const leftChanges = left.new + left.changed + left.deleted;
      const rightChanges = right.new + right.changed + right.deleted;
      return rightChanges - leftChanges || left.metadataType.localeCompare(right.metadataType);
    })[0];
    if (!best) return;
    didAutoSelectType.current = true;
    setFilters((current) => ({ ...current, metadataType: best.metadataType }));
  }, [typeSummaries, filters.metadataType]);

  const selectedSummary = useMemo(() => {
    const selectedItems = items.filter((item) => selectedKeys.has(buildCompareKey(item.metadataType, item.fullName)));
    const byType = compareTypeSummaries(selectedItems);
    const deployable = selectedItems.filter((item) => ['new', 'changed'].includes(item.diffType)).length;
    const destructive = selectedItems.filter((item) => item.diffType === 'deleted').length;
    return { byType, deployable, destructive, total: selectedItems.length };
  }, [items, selectedKeys]);

  const activeMetadataType = filters.metadataType;

  const activeSummary = useMemo(
    () => typeSummaries.find((type) => type.metadataType === activeMetadataType) ?? null,
    [typeSummaries, activeMetadataType],
  );

  const visibleCounts = useMemo(() => {
    const counts = { new: 0, changed: 0, deleted: 0, same: 0, unknown: 0, total: 0 };
    const typeAndSearchItems = filterCompareItems(items, {
      metadataType: filters.metadataType,
      search: filters.search,
    });
    for (const item of typeAndSearchItems) {
      counts[item.diffType] += 1;
      counts.total += 1;
    }
    return counts;
  }, [filters.metadataType, filters.search, items]);

  const toggleDiffType = useCallback((diffType: CompareDiffType) => {
    setFilters((current) => {
      const next = current.diffTypes.includes(diffType)
        ? current.diffTypes.filter((type) => type !== diffType)
        : [...current.diffTypes, diffType];
      return { ...current, diffTypes: next };
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    onSelectItems(filteredItems, true);
  }, [filteredItems, onSelectItems]);

  const clearAllVisible = useCallback(() => {
    onSelectItems(filteredItems, false);
  }, [filteredItems, onSelectItems]);

  const clearAllSelected = useCallback(() => {
    const selected = items.filter((item) =>
      selectedKeys.has(buildCompareKey(item.metadataType, item.fullName)));
    onSelectItems(selected, false);
  }, [items, onSelectItems, selectedKeys]);

  const selectAllInType = useCallback(() => {
    const typeItems = filteredItems.filter((item) => item.metadataType === activeMetadataType);
    onSelectItems(typeItems, true);
  }, [activeMetadataType, filteredItems, onSelectItems]);

  const clearAllInType = useCallback(() => {
    const typeItems = filteredItems.filter((item) => item.metadataType === activeMetadataType);
    onSelectItems(typeItems, false);
  }, [activeMetadataType, filteredItems, onSelectItems]);

  const clearFilters = useCallback(() => {
    setFilters({ metadataType: '', diffTypes: [...DIFF_ORDER], search: '', selectedOnly: false });
  }, []);

  const loadRelatedChildren = useCallback(async (objectName: string) => {
    if (!comparisonId) return;
    setRelatedLoading(true);
    setRelatedError(null);
    try {
      const response = await api<CompareRelatedChildren>(
        `/metadata/compare/${comparisonId}/children?objectName=${encodeURIComponent(objectName)}`,
      );
      setRelatedChildren(response);
      setSelectedItemKey(objectName);
    } catch (cause) {
      setRelatedError(cause instanceof Error ? cause.message : 'Could not load related components.');
    } finally {
      setRelatedLoading(false);
    }
  }, [comparisonId]);

  const closeRelatedPanel = useCallback(() => {
    setSelectedItemKey(null);
    setRelatedChildren(null);
    setRelatedError(null);
  }, []);

  const isObjectRelated = (item: CompareItem) =>
    item.metadataType === 'CustomObject' && !item.fullName.includes('.');

  const running = comparisonStatus === 'running' || comparing;
  const empty = !items.length && !running;
  const anySelected = selectedKeys.size > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/60 bg-card/30 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitCompare className="size-4 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{sourceLabel}</span>
                <span className="text-muted-foreground" aria-hidden="true">&rarr;</span>
                <span className="truncate">{targetLabel}</span>
              </p>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {comparisonSummary
                  ? `${comparisonSummary.total} components inspected${running ? ' · still loading…' : ''}`
                  : running
                    ? 'Discovering metadata types and components from both orgs…'
                    : 'Metadata is loaded automatically from the selected source and target orgs.'}
              </p>
            </div>
          </div>
          {anySelected && (
            <Button size="sm" variant="outline" onClick={clearAllSelected}>
              Clear {selectedKeys.size} selected
            </Button>
          )}
        </div>
        {comparisonSummary && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatChip label="Components" value={comparisonSummary.total} tone="neutral" />
            <StatChip label="New" value={comparisonSummary.new} tone="new" />
            <StatChip label="Changed" value={comparisonSummary.changed} tone="changed" />
            <StatChip label="Deleted" value={comparisonSummary.deleted} tone="deleted" />
            <StatChip label="Not inspected" value={comparisonSummary.unknown} tone="unknown" />
            <StatChip label="Selected" value={selectedSummary.total} tone="selected" />
          </div>
        )}
      </div>

      {running && (
        <InlineAlert variant="info">
          {comparisonSummary?.progress?.phase === 'resolving_xml'
            ? `Inspecting source and target XML (${comparisonSummary.progress.resolvedItems ?? 0} of ${comparisonSummary.progress.totalItems ?? 0}). Results update automatically.`
            : comparisonSummary?.progress?.totalTypes
              ? `Loading metadata types (${comparisonSummary.progress.completedTypes} of ${comparisonSummary.progress.totalTypes}). Results appear as each type completes.`
              : 'Discovering all supported metadata types. Results appear automatically.'}
        </InlineAlert>
      )}

      {comparisonStatus === 'failed' && (
        <InlineAlert variant="error" title="Metadata loading failed">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>The org metadata could not be loaded. Check the org connections and retry.</span>
            <Button size="sm" variant="outline" onClick={onRetryComparison}>
              Retry metadata loading
            </Button>
          </div>
        </InlineAlert>
      )}

      {comparisonSummary && comparisonSummary.typeErrors && (
        <InlineAlert variant="warning" title="Some metadata types could not be compared">
          {Array.isArray(comparisonSummary.typeErrors)
            ? `${comparisonSummary.typeErrors
                .slice(0, 5)
                .map((error) => `${error.metadataType} (${error.org}): ${error.error}`)
                .join('; ')}${comparisonSummary.typeErrors.length > 5
                ? `; and ${comparisonSummary.typeErrors.length - 5} more type errors`
                : ''}`
            : 'One or more metadata types returned errors from the orgs.'}
        </InlineAlert>
      )}

      {comparisonStatus === 'partial' && Boolean(comparisonSummary?.progress?.failedItems) && (
        <InlineAlert variant="warning" title="Some XML could not be inspected">
          {comparisonSummary?.progress?.failedItems} component
          {comparisonSummary?.progress?.failedItems === 1 ? '' : 's'} could not be classified.
          They remain under Not inspected and are not deployable until their XML can be loaded.
        </InlineAlert>
      )}

      {empty && !running && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <ListTree className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">No metadata components found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Return to Source and confirm that both connected orgs are available.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row">
          <aside
            className={cn(
              'shrink-0 overflow-hidden rounded-xl border border-border/60 bg-card/30 transition-all duration-200',
              sidebarOpen ? 'w-full md:w-64' : 'w-full md:w-12',
            )}
          >
            <div className="flex items-center justify-between border-b border-border/60 p-2">
              <span className={cn('px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground', !sidebarOpen && 'md:hidden')}>
                Metadata types
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen((current) => !current)}
                className="rounded p-1 hover:bg-muted/50"
                aria-label={sidebarOpen ? 'Collapse metadata type list' : 'Expand metadata type list'}
              >
                {sidebarOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            </div>
            <div className={cn('max-h-[60vh] overflow-auto p-2', !sidebarOpen && 'md:hidden')}>
              <TypeList
                summaries={typeSummaries}
                active={activeMetadataType}
                filters={filters}
                onSelect={(metadataType) => {
                  didAutoSelectType.current = true;
                  setFilters((current) => ({ ...current, metadataType }));
                }}
                onShowAll={() => {
                  didAutoSelectType.current = true;
                  setFilters((current) => ({ ...current, metadataType: '' }));
                }}
              />
            </div>
          </aside>

          <section className="min-w-0 flex-1 rounded-xl border border-border/60 bg-card/30 p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    value={filters.search}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Search component name…"
                    className="pl-9"
                    aria-label="Search component name"
                  />
                  {filters.search && (
                    <button
                      type="button"
                      onClick={() => setFilters((current) => ({ ...current, search: '' }))}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border/60 p-1">
                  {DIFF_ORDER.map((diffType) => (
                    <DiffTypeToggle
                      key={diffType}
                      diffType={diffType}
                      active={filters.diffTypes.includes(diffType)}
                      count={visibleCounts[diffType]}
                      onClick={() => toggleDiffType(diffType)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setFilters((current) => ({
                      ...current,
                      selectedOnly: !current.selectedOnly,
                    }))}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                      filters.selectedOnly
                        ? 'border border-primary/40 bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/40',
                    )}
                    aria-pressed={filters.selectedOnly}
                  >
                    <CheckSquare className="size-3.5" aria-hidden="true" />
                    Selected
                    <span className="text-muted-foreground">{selectedKeys.size}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Filter className="size-3.5" aria-hidden="true" />
                  <span>
                    {filters.metadataType ? `Type: ${filters.metadataType}` : 'All types'}
                    {' · '}
                    {filteredItems.length} shown
                  </span>
                  {selectedSummary.total > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                      {selectedSummary.total} selected
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={selectAllVisible}>
                    <CheckSquare className="mr-1.5 size-3.5" /> Select all shown
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearAllVisible}>
                    <Square className="mr-1.5 size-3.5" /> Clear shown
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearFilters}>
                    Reset filters
                  </Button>
                </div>
              </div>

              {activeSummary && filters.metadataType && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/10 p-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>{activeSummary.metadataType}</span>
                    <span className="text-xs text-muted-foreground">
                      {activeSummary.total} component{activeSummary.total === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {DIFF_ORDER.map((diffType) => (
                      <span
                        key={diffType}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          activeSummary[diffType] > 0 ? DIFF_CONFIG[diffType].color : 'bg-muted/30 text-muted-foreground',
                        )}
                      >
                        {DIFF_CONFIG[diffType].chip}: {activeSummary[diffType]}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={selectAllInType}>
                      Select all
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearAllInType}>
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              {pagedItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No components match the current filters.
                </div>
              ) : (
                <div className="max-h-[50vh] overflow-auto rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                        <th className="w-10 p-2">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="p-2">Component</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">State</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedItems.map((item) => {
                        const key = buildCompareKey(item.metadataType, item.fullName);
                        const selected = selectedKeys.has(key);
                        return (
                          <CompareRow
                            key={key}
                            item={item}
                            selected={selected}
                            active={selectedItem?.metadataType === item.metadataType
                              && selectedItem.fullName === item.fullName}
                            onToggle={() => onToggleItem(item)}
                            onOpen={() => onSelectItem(item)}
                            onShowRelated={() => loadRelatedChildren(item.fullName)}
                            showRelated={isObjectRelated(item)}
                            activeRelated={selectedItemKey === item.fullName}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((current) => current - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((current) => current + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {itemDiffError && (
                <InlineAlert variant="error" title="Could not load component XML">
                  {itemDiffError}
                </InlineAlert>
              )}

              <MetadataXmlDiffViewer
                selectedItem={selectedItem}
                itemDiff={itemDiff}
                loading={itemDiffLoading}
                sourceLabel={sourceLabel}
                targetLabel={targetLabel}
              />
            </div>
          </section>
        </div>
      )}

      {selectedSummary.total > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Selected for deployment</p>
            <p className="text-xs text-muted-foreground">
              {selectedSummary.deployable} deployable · {selectedSummary.destructive} destructive
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedSummary.byType.length === 0 ? (
              <span className="text-xs text-muted-foreground">No selection</span>
            ) : (
              selectedSummary.byType.map((type) => (
                <span
                  key={type.metadataType}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-xs"
                >
                  <span className="font-medium">{type.metadataType}</span>
                  {DIFF_ORDER.map((diffType) =>
                    type[diffType] > 0 ? (
                      <span
                        key={diffType}
                        className={cn('rounded px-1.5 py-0.5', DIFF_CONFIG[diffType].color)}
                      >
                        {type[diffType]} {DIFF_CONFIG[diffType].chip}
                      </span>
                    ) : null,
                  )}
                </span>
              ))
            )}
          </div>
          {selectedSummary.destructive > 0 && (
            <InlineAlert variant="warning" className="mt-3">
              <Trash2 className="mr-1.5 inline size-3.5" aria-hidden="true" />
              {selectedSummary.destructive} destructive change{selectedSummary.destructive === 1 ? '' : 's'} selected.
              These will be sent as a separate destructive manifest and require explicit review.
            </InlineAlert>
          )}
        </div>
      )}

      {selectedItemKey && (
        <RelatedPanel
          objectName={selectedItemKey}
          children={relatedChildren}
          loading={relatedLoading}
          error={relatedError}
          onClose={closeRelatedPanel}
          onAddChild={(childType) => {
            const children = items.filter(
              (item) => item.metadataType === childType && isObjectChild(item, selectedItemKey),
            );
            onSelectItems(children, true);
          }}
        />
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'selected' | CompareDiffType;
}) {
  const toneClass =
    tone === 'selected'
      ? 'border-primary/30 bg-primary/10 text-primary'
      : tone === 'neutral'
        ? 'border-border/60 bg-muted/20 text-foreground'
        : DIFF_CONFIG[tone].color;
  return (
    <div className={cn('rounded-lg border px-3 py-2', toneClass)}>
      <p className="text-lg font-semibold leading-none tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-[11px] font-medium opacity-80">{label}</p>
    </div>
  );
}

function TypeList({
  summaries,
  active,
  filters,
  onSelect,
  onShowAll,
}: {
  summaries: CompareTypeSummary[];
  active: string;
  filters: CompareFilters;
  onSelect: (metadataType: string) => void;
  onShowAll: () => void;
}) {
  const totalAll = useMemo(
    () => summaries.reduce((sum, type) => sum + type.total, 0),
    [summaries],
  );

  return (
    <div className="space-y-1" role="listbox" aria-label="Metadata types">
      <button
        type="button"
        role="option"
        aria-selected={!filters.metadataType}
        onClick={onShowAll}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
          !filters.metadataType ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40',
        )}
      >
        <span>All types</span>
        <span className="text-xs text-muted-foreground">{totalAll}</span>
      </button>
      {summaries.map((type) => (
        <button
          key={type.metadataType}
          type="button"
          role="option"
          aria-selected={type.metadataType === active}
          onClick={() => onSelect(type.metadataType)}
          className={cn(
            'flex w-full flex-col rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
            type.metadataType === active ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{type.metadataType}</span>
            <span className="text-xs text-muted-foreground">{type.total}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {DIFF_ORDER.map((diffType) =>
              type[diffType] > 0 ? (
                <span
                  key={diffType}
                  className={cn('rounded px-1 py-0 text-[10px]', DIFF_CONFIG[diffType].color)}
                >
                  {type[diffType]}
                </span>
              ) : null,
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function DiffTypeToggle({
  diffType,
  active,
  count,
  onClick,
}: {
  diffType: CompareDiffType;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const config = DIFF_CONFIG[diffType];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
        active ? config.color : 'text-muted-foreground hover:bg-muted/40',
        active && 'border',
      )}
      aria-pressed={active}
    >
      <span className={cn('size-2 rounded-full', active ? 'bg-current' : 'bg-muted-foreground/50')} />
      {config.label}
      <span className="text-muted-foreground">{count}</span>
    </button>
  );
}

function CompareRow({
  item,
  selected,
  active,
  onToggle,
  onOpen,
  onShowRelated,
  showRelated,
  activeRelated,
}: {
  item: CompareItem;
  selected: boolean;
  active: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onShowRelated: () => void;
  showRelated: boolean;
  activeRelated: boolean;
}) {
  const destructive = item.diffType === 'deleted';
  return (
    <tr
      className={cn(
        'border-b border-border/40 last:border-0 transition-colors',
        selected && 'bg-primary/5',
        active && 'bg-primary/10',
        activeRelated && 'bg-primary/10',
      )}
    >
      <td className="p-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${item.metadataType} ${item.fullName}`}
        />
      </td>
      <td className="p-2 font-medium">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            'text-left text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            destructive && 'line-through opacity-70',
          )}
          aria-pressed={active}
        >
          {item.fullName}
        </button>
      </td>
      <td className="p-2 text-muted-foreground">{item.metadataType}</td>
      <td className="p-2">
        <span className={cn('rounded-full border px-2 py-0.5 text-xs capitalize', DIFF_CONFIG[item.diffType].color)}>
          {DIFF_CONFIG[item.diffType].chip}
        </span>
      </td>
      <td className="p-2 text-right">
        {showRelated && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onShowRelated}
            aria-pressed={activeRelated}
            aria-label={`Show related components for ${item.fullName}`}
          >
            <Eye className="mr-1.5 size-3.5" /> Related
          </Button>
        )}
      </td>
    </tr>
  );
}

function RelatedPanel({
  objectName,
  children,
  loading,
  error,
  onClose,
  onAddChild,
}: {
  objectName: string;
  children: CompareRelatedChildren | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAddChild: (childType: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTree className="size-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium">Related components: {objectName}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close related components panel">
          <X className="size-4" />
        </Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading related components…</p>}
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      {!loading && !error && children?.childTypes.length === 0 && (
        <p className="text-sm text-muted-foreground">No related child components found in this comparison.</p>
      )}
      {!loading && !error && children && children.childTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {children.childTypes.map((child) => (
            <div
              key={child.type}
              className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span className="font-medium">{child.type}</span>
              <span className="text-xs text-muted-foreground">{child.count} component{child.count === 1 ? '' : 's'}</span>
              <Button size="sm" variant="ghost" onClick={() => onAddChild(child.type)}>
                Add to selection
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
