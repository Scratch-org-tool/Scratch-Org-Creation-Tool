'use client';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/studio';
import { CheckCircle2, Cloud } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { MetadataCompareHook } from './use-metadata-compare';

export function MetadataCompareSetup({ w }: { w: MetadataCompareHook }) {
  const source = w.orgById(w.form.sourceOrgId);
  const target = w.orgById(w.form.targetOrgId);

  return (
    <GlassCard title="Select orgs to compare" description="Choose source and target, then run a full metadata comparison.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OrgCard
          label="Source org"
          org={source}
          selected={Boolean(w.form.sourceOrgId)}
          orgs={w.orgs}
          value={w.form.sourceOrgId}
          onChange={(id) => w.setForm({ ...w.form, sourceOrgId: id })}
          count={w.previewCounts?.source}
        />
        <OrgCard
          label="Target org"
          org={target}
          selected={Boolean(w.form.targetOrgId)}
          orgs={w.orgs}
          value={w.form.targetOrgId}
          onChange={(id) => w.setForm({ ...w.form, targetOrgId: id })}
          count={w.previewCounts?.target}
        />
      </div>
      {w.canCompare && w.previewCounts && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          {w.previewCounts.source.toLocaleString()} items in source · {w.previewCounts.target.toLocaleString()} in target (sample types)
        </p>
      )}
      <div className="flex justify-end mt-4">
        <Button
          onClick={() => void w.startComparison()}
          loading={w.compareStarting}
          disabled={!w.canCompare}
        >
          Compare now
        </Button>
      </div>
    </GlassCard>
  );
}

function OrgCard({
  label,
  org,
  selected,
  orgs,
  value,
  onChange,
  count,
}: {
  label: string;
  org?: { alias: string };
  selected: boolean;
  orgs: Array<{ id: string; alias: string }>;
  value: string;
  onChange: (id: string) => void;
  count?: number;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        selected
          ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
          : 'border-border/60 bg-card/40',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold mt-0.5">{org?.alias ?? 'Select an org'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Cloud className="h-4 w-4 text-muted-foreground" />
          {selected && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        </div>
      </div>
      <select
        className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select org…</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.alias}</option>
        ))}
      </select>
      {selected && count !== undefined && (
        <p className="text-[11px] text-muted-foreground mt-2">{count.toLocaleString()} metadata items found</p>
      )}
    </div>
  );
}
