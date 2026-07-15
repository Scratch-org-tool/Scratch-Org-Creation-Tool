'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Expand, GitCompare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassCard, InlineAlert } from '@/components/studio';
import {
  buildDiffHunks,
  extractHunkContent,
  getDiffWindowRange,
  hunkElementId,
  scrollToHunk,
  type DiffLine,
  type HunkContent,
} from './diff-navigation';
import type { MetadataCompareHook } from './use-metadata-compare';

const MAX_RENDERED_DIFF_LINES = 800;
const MAX_HUNK_SUMMARY_CHARS = 20_000;

function collapseLongDiffText(text: string): string {
  if (text.length <= MAX_HUNK_SUMMARY_CHARS) return text;
  return `${text.slice(0, MAX_HUNK_SUMMARY_CHARS)}\n\n… remaining change content collapsed for performance …`;
}

export function MetadataItemDiffPanel({ w }: { w: MetadataCompareHook }) {
  const [expanded, setExpanded] = useState(false);

  if (!w.selectedItem) {
    return (
      <GlassCard
        title={
          <span className="inline-flex items-center gap-2 text-sm">
            <GitCompare className="w-4 h-4 text-primary" />
            Source vs target diff
          </span>
        }
      >
        <p className="text-xs text-muted-foreground text-center py-8">
          Select a row to view source vs target XML
        </p>
      </GlassCard>
    );
  }

  if (w.diffLoading) {
    return (
      <GlassCard title="Source vs target diff">
        <p className="text-xs text-muted-foreground text-center py-8">Loading XML diff…</p>
      </GlassCard>
    );
  }

  const sourceOrg = w.orgById(w.form.sourceOrgId)?.alias ?? 'Source';
  const targetOrg = w.orgById(w.form.targetOrgId)?.alias ?? 'Target';
  const failed = w.itemDiff?.loadStatus === 'failed';
  const empty = !w.itemDiff?.sourceXml && !w.itemDiff?.targetXml;
  const sourceXml = w.itemDiff?.sourceXml ?? '';
  const targetXml = w.itemDiff?.targetXml ?? '';
  const diffLines = w.itemDiff?.diffLines;
  const diffKey = `${w.selectedItem.metadataType}::${w.selectedItem.fullName}`;

  const statusBadge =
    w.itemDiff?.contentDiffers !== undefined && !failed && !empty ? (
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded ${
          w.itemDiff.contentDiffers
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {w.selectedItem.diffType === 'new'
          ? 'New in source'
          : w.selectedItem.diffType === 'deleted'
            ? 'Only in target'
            : w.itemDiff.contentDiffers
              ? 'Content differs'
              : 'Identical content'}
      </span>
    ) : null;

  return (
    <>
      <GlassCard
        title={
          <span className="inline-flex items-center gap-2 text-sm font-mono truncate">
            <GitCompare className="w-4 h-4 text-primary shrink-0" />
            {w.selectedItem.fullName}
          </span>
        }
        headerAction={
          <div className="flex items-center gap-2 shrink-0">
            {statusBadge}
            {!failed && !empty && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2"
                onClick={() => setExpanded(true)}
              >
                <Expand className="w-3 h-3 mr-1" />
                Full view
              </Button>
            )}
          </div>
        }
      >
        {(failed || w.itemDiff?.retrieveWarnings?.source || w.itemDiff?.retrieveWarnings?.target) && (
          <InlineAlert variant="warning" className="mb-3">
            {w.itemDiff?.retrieveWarnings?.source && (
              <p className="text-xs">Source: {w.itemDiff.retrieveWarnings.source}</p>
            )}
            {w.itemDiff?.retrieveWarnings?.target && (
              <p className="text-xs">Target: {w.itemDiff.retrieveWarnings.target}</p>
            )}
            {failed && empty && (
              <p className="text-xs">Could not retrieve metadata XML from one or both orgs.</p>
            )}
          </InlineAlert>
        )}
        <DiffView
          diffKey={diffKey}
          sourceLabel={sourceOrg}
          targetLabel={targetOrg}
          sourceXml={sourceXml}
          targetXml={targetXml}
          diffLines={diffLines}
          heightClass="h-[28rem]"
        />
        {w.itemDiff?.contentDiffers && w.selectedItem.diffType === 'same' && (
          <p className="text-[10px] text-amber-600 mt-2">
            Content differs — item upgraded to Changed. You can now select it for deploy.
          </p>
        )}
        {!w.itemDiff?.contentDiffers && !failed && !empty && w.selectedItem.diffType !== 'new' && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Source and target content are identical — no deploy needed.
          </p>
        )}
      </GlassCard>

      {expanded && (
        <DiffFullscreen
          title={w.selectedItem.fullName}
          diffKey={diffKey}
          sourceLabel={sourceOrg}
          targetLabel={targetOrg}
          sourceXml={sourceXml}
          targetXml={targetXml}
          diffLines={diffLines}
          statusBadge={statusBadge}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}

function DiffView({
  diffKey,
  sourceLabel,
  targetLabel,
  sourceXml,
  targetXml,
  diffLines,
  heightClass,
}: {
  diffKey: string;
  sourceLabel: string;
  targetLabel: string;
  sourceXml: string;
  targetXml: string;
  diffLines?: DiffLine[];
  heightClass: string;
}) {
  const hunks = useMemo(
    () => (diffLines?.length ? buildDiffHunks(diffLines) : []),
    [diffLines],
  );
  const [activeHunkIndex, setActiveHunkIndex] = useState(0);

  useEffect(() => {
    setActiveHunkIndex(0);
  }, [diffKey, diffLines]);

  const goPrev = useCallback(() => {
    setActiveHunkIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveHunkIndex((i) => Math.min(hunks.length - 1, i + 1));
  }, [hunks.length]);

  useEffect(() => {
    if (!hunks.length) return;
    const hunk = hunks[activeHunkIndex];
    if (hunk) scrollToHunk(hunk);
  }, [activeHunkIndex, hunks]);

  useEffect(() => {
    if (!hunks.length) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goPrev, goNext, hunks.length]);

  const activeHunk = hunks[activeHunkIndex];
  const activeChunkIndices = useMemo(
    () => new Set(activeHunk?.chunkIndices ?? []),
    [activeHunk],
  );
  const allChangeChunkIndices = useMemo(
    () => new Set(hunks.flatMap((h) => h.chunkIndices)),
    [hunks],
  );
  const activeHunkContent = useMemo(
    () => (activeHunk && diffLines?.length ? extractHunkContent(diffLines, activeHunk) : null),
    [activeHunk, diffLines],
  );
  const visibleRange = useMemo(() => {
    if (!diffLines) return null;
    return getDiffWindowRange(diffLines.length, activeHunk?.chunkIndices ?? []);
  }, [activeHunk, diffLines]);

  return (
    <div className={`rounded-md border border-border overflow-hidden flex flex-col ${heightClass}`}>
      {hunks.length > 0 && (
        <div className="flex items-center justify-center gap-2 px-2 py-1.5 border-b border-border bg-muted/20 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={activeHunkIndex <= 0}
            onClick={goPrev}
            aria-label="Previous change"
            title="Previous change (Alt+↑)"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <span className="text-[10px] text-muted-foreground tabular-nums min-w-[5.5rem] text-center">
            Change {activeHunkIndex + 1} of {hunks.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={activeHunkIndex >= hunks.length - 1}
            onClick={goNext}
            aria-label="Next change"
            title="Next change (Alt+↓)"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      )}
      {activeHunkContent && (
        <HunkChangeSummary
          sourceLabel={sourceLabel}
          targetLabel={targetLabel}
          content={activeHunkContent}
        />
      )}
      <div className="grid grid-cols-2 flex-1 min-h-0">
        <DiffPane
          label={sourceLabel}
          xml={sourceXml}
          side="source"
          diffLines={diffLines}
          activeChunkIndices={activeChunkIndices}
          allChangeChunkIndices={allChangeChunkIndices}
          focusMode={hunks.length > 0}
          visibleRange={visibleRange}
        />
        <DiffPane
          label={targetLabel}
          xml={targetXml}
          side="target"
          diffLines={diffLines}
          activeChunkIndices={activeChunkIndices}
          allChangeChunkIndices={allChangeChunkIndices}
          focusMode={hunks.length > 0}
          visibleRange={visibleRange}
        />
      </div>
    </div>
  );
}

function HunkChangeSummary({
  sourceLabel,
  targetLabel,
  content,
}: {
  sourceLabel: string;
  targetLabel: string;
  content: HunkContent;
}) {
  const sourceBody = content.sourceText.trim()
    ? collapseLongDiffText(content.sourceText)
    : null;
  const targetBody = content.targetText.trim()
    ? collapseLongDiffText(content.targetText)
    : null;

  return (
    <div className="grid grid-cols-2 border-b border-border shrink-0 h-36 min-h-[8rem]">
      <div className="border-r border-border flex flex-col min-h-0 overflow-hidden bg-emerald-500/5">
        <div className="px-2 py-1 text-[10px] font-medium border-b border-border/60 text-emerald-800 dark:text-emerald-400 shrink-0">
          {sourceLabel} — Will deploy
        </div>
        <pre className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2 text-[10px] font-mono leading-relaxed m-0 whitespace-pre-wrap">
          {sourceBody ?? (
            <span className="text-muted-foreground italic">Nothing to deploy from source for this change</span>
          )}
        </pre>
      </div>
      <div className="flex flex-col min-h-0 overflow-hidden bg-red-500/5">
        <div className="px-2 py-1 text-[10px] font-medium border-b border-border/60 text-red-800 dark:text-red-400 shrink-0">
          {targetLabel} — Will be overridden
        </div>
        <pre className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2 text-[10px] font-mono leading-relaxed m-0 whitespace-pre-wrap">
          {targetBody ?? (
            <span className="text-muted-foreground italic">
              {content.kind === 'add'
                ? 'Nothing in target — new deploy'
                : 'Nothing to override for this change'}
            </span>
          )}
        </pre>
      </div>
    </div>
  );
}

function DiffFullscreen({
  title,
  diffKey,
  sourceLabel,
  targetLabel,
  sourceXml,
  targetXml,
  diffLines,
  statusBadge,
  onClose,
}: {
  title: string;
  diffKey: string;
  sourceLabel: string;
  targetLabel: string;
  sourceXml: string;
  targetXml: string;
  diffLines?: DiffLine[];
  statusBadge: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!inset-0 !left-0 !top-0 !h-dvh !w-screen !max-w-none !max-h-none !translate-x-0 !translate-y-0 rounded-none flex flex-col gap-0 bg-background/95 backdrop-blur-sm p-4 md:p-6 [&>button:last-child]:hidden">
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <GitCompare className="w-4 h-4 text-primary shrink-0" />
          <DialogTitle className="text-sm font-mono font-medium truncate">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Full-screen source and target metadata comparison
          </DialogDescription>
          {statusBadge}
        </div>
        <DialogClose asChild>
          <Button type="button" variant="outline" size="sm">
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </DialogClose>
      </div>
      <div className="flex-1 min-h-0">
        <DiffView
          diffKey={diffKey}
          sourceLabel={sourceLabel}
          targetLabel={targetLabel}
          sourceXml={sourceXml}
          targetXml={targetXml}
          diffLines={diffLines}
          heightClass="h-full"
        />
      </div>
      </DialogContent>
    </Dialog>
  );
}

function DiffPane({
  label,
  xml,
  side,
  diffLines,
  activeChunkIndices,
  allChangeChunkIndices,
  focusMode,
  visibleRange,
}: {
  label: string;
  xml: string;
  side: 'source' | 'target';
  diffLines?: DiffLine[];
  activeChunkIndices: Set<number>;
  allChangeChunkIndices: Set<number>;
  focusMode: boolean;
  visibleRange: { start: number; end: number } | null;
}) {
  const rendered = diffLines?.length
    ? diffLines.slice(visibleRange?.start ?? 0, visibleRange?.end).map((line, offset) => {
        const i = offset + (visibleRange?.start ?? 0);
        const show =
          (side === 'source' && (line.added || (!line.added && !line.removed))) ||
          (side === 'target' && (line.removed || (!line.added && !line.removed)));
        if (!show) return null;

        const isChange = !!line.added || !!line.removed;
        const isActive = isChange && activeChunkIndices.has(i);
        const bgCls = line.added
          ? 'bg-emerald-500/20'
          : line.removed
            ? 'bg-red-500/20'
            : '';
        const activeCls = isActive ? 'ring-2 ring-primary/60 ring-inset rounded-sm' : '';
        let dimCls = '';
        if (focusMode) {
          if (isActive) dimCls = 'opacity-100';
          else if (isChange && allChangeChunkIndices.has(i)) dimCls = 'opacity-25';
          else dimCls = 'opacity-40';
        }

        return (
          <span
            key={i}
            id={isChange ? hunkElementId(side, i) : undefined}
            className={`block whitespace-pre-wrap ${bgCls} ${activeCls} ${dimCls}`}
          >
            {line.value}
          </span>
        );
      })
    : null;

  const hasRendered = rendered?.some(Boolean);
  let plainXml = xml;
  if (!diffLines?.length) {
    const xmlLines = xml.split('\n');
    if (xmlLines.length > MAX_RENDERED_DIFF_LINES) {
      plainXml = `${xmlLines.slice(0, MAX_RENDERED_DIFF_LINES).join('\n')}\n\n… remaining lines collapsed for performance …`;
    }
  }

  return (
    <div className="border-r border-border last:border-r-0 flex flex-col min-h-0 h-full overflow-hidden">
      <div className="px-2 py-1 text-[10px] font-medium bg-muted/30 border-b border-border shrink-0">
        {label}
      </div>
      <pre className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 text-[11px] font-mono leading-relaxed m-0">
        {visibleRange?.start ? (
          <span className="block text-muted-foreground italic">
            … {visibleRange.start.toLocaleString()} lines collapsed above …{'\n'}
          </span>
        ) : null}
        {hasRendered ? rendered : (plainXml || <span className="text-muted-foreground italic">No content</span>)}
        {visibleRange && diffLines && visibleRange.end < diffLines.length ? (
          <span className="block text-muted-foreground italic">
            {'\n'}… {(diffLines.length - visibleRange.end).toLocaleString()} lines collapsed below …
          </span>
        ) : null}
      </pre>
    </div>
  );
}
