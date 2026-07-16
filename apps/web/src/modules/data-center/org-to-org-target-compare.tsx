'use client';

import { Loader2, PlusCircle, RefreshCw } from 'lucide-react';
import { InlineAlert } from '@/components/studio';
import { cn } from '@/utils/cn';
import type { OrgToOrgDeployStrategy, OrgToOrgObjectCompareState, OrgToOrgObjectInfo } from './types';

interface OrgToOrgTargetCompareProps {
  objects: OrgToOrgObjectInfo[];
  compare: Map<string, OrgToOrgObjectCompareState>;
  loading?: boolean;
  strategy: OrgToOrgDeployStrategy;
  targetLabel: string;
}

function CompareChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'create' | 'update';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs tabular-nums',
        tone === 'create'
          ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
          : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {value.toLocaleString()} {label}
    </span>
  );
}

/**
 * Review-step summary of how the selected records relate to the target org:
 * how many keys exist only in the source (new records) vs already in the
 * target (updated by upsert, duplicated by insert).
 */
export function OrgToOrgTargetCompare({
  objects,
  compare,
  loading,
  strategy,
  targetLabel,
}: OrgToOrgTargetCompareProps) {
  if (objects.length === 0) return null;

  const duplicateRisk =
    strategy === 'insert'
    && objects.some((obj) => (compare.get(obj.apiName)?.summary?.inBoth ?? 0) > 0);

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="px-4 py-2.5 bg-secondary/30 border-b border-border/60 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Target impact</p>
          <p className="text-xs text-muted-foreground">
            Source records matched against <span className="font-medium text-foreground">{targetLabel}</span> by
            each object&apos;s match field.
          </p>
        </div>
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Comparing…
          </span>
        )}
      </div>

      <ul className="divide-y divide-border/40">
        {objects.map((obj) => {
          const state = compare.get(obj.apiName);
          return (
            <li key={obj.apiName} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm font-medium truncate">{obj.label}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {obj.apiName}
                  {state?.matchField ? ` · match on ${state.matchField}` : ''}
                </p>
              </div>
              {!state && (
                <span className="text-xs text-muted-foreground">
                  {loading ? 'Comparing…' : 'Not compared'}
                </span>
              )}
              {state?.error && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Comparison unavailable: {state.error}
                </span>
              )}
              {state?.summary && (
                <div className="flex flex-wrap items-center gap-2">
                  <CompareChip
                    icon={PlusCircle}
                    label="new in target"
                    value={state.summary.onlyInSource}
                    tone="create"
                  />
                  <CompareChip
                    icon={RefreshCw}
                    label={strategy === 'upsert' ? 'will update' : 'already exist'}
                    value={state.summary.inBoth}
                    tone="update"
                  />
                  {state.truncated && (
                    <span className="text-xs text-muted-foreground">approx.</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {duplicateRisk && (
        <div className="px-4 py-2.5 border-t border-border/60">
          <InlineAlert variant="warning">
            Insert does not match existing records — rows that already exist in {targetLabel} will be
            created again. Switch the strategy to upsert to update them instead.
          </InlineAlert>
        </div>
      )}
    </div>
  );
}
