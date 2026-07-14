'use client';

import { GitCompare, Plus, Minus, RefreshCw, CheckSquare } from 'lucide-react';
import { StatCard, StatCardGrid } from '@/components/studio/stat-card';
import type { MetadataCompareHook } from './use-metadata-compare';

export function MetadataCompareKpis({ w }: { w: MetadataCompareHook }) {
  if (!w.summary && w.phase !== 'compare') return null;

  const s = w.summary;
  return (
    <StatCardGrid cols={5}>
      <StatCard label="New" value={s?.new ?? 0} icon={Plus} iconClass="text-emerald-500" />
      <StatCard label="Changed" value={s?.changed ?? 0} icon={RefreshCw} iconClass="text-amber-500" />
      <StatCard label="Deleted" value={s?.deleted ?? 0} icon={Minus} iconClass="text-red-500" />
      <StatCard label="No difference" value={s?.same ?? 0} icon={GitCompare} iconClass="text-muted-foreground" />
      <StatCard label="Selected" value={w.deployableCount} icon={CheckSquare} iconClass="text-primary" />
    </StatCardGrid>
  );
}
