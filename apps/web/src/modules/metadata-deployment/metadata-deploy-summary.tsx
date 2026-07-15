'use client';

import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { FormSection, InlineAlert } from '@/components/studio';
import { DIFF_TYPE_LABELS, itemKey, TEST_LEVEL_OPTIONS } from './types';
import type { MetadataCompareHook } from './use-metadata-compare';

export function MetadataDeploySummary({ w }: { w: MetadataCompareHook }) {
  const deployableItems = w.getDeployableItems();
  const deployableCount = w.deployableCount;
  const source = w.orgById(w.form.sourceOrgId)?.alias ?? 'Source';
  const target = w.orgById(w.form.targetOrgId)?.alias ?? 'Target';

  const counts = { new: 0, changed: 0, deleted: 0, same: 0, unknown: 0 };
  for (const row of deployableItems) counts[row.diffType] += 1;

  return (
    <FormSection title="Review package">
      <p className="text-xs text-muted-foreground mb-3">
        Deploying from <strong>{source}</strong> to <strong>{target}</strong>
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-center">
        <MiniStat label="Deployable" value={deployableCount} />
        <MiniStat label="New" value={counts.new} />
        <MiniStat label="Changed" value={counts.changed} />
        <MiniStat label="Excluded" value={w.excludedKeys.size} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <Label>Deployment name</Label>
          <input
            className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={w.form.deploymentName}
            onChange={(e) => w.setForm({ ...w.form, deploymentName: e.target.value })}
            placeholder="e.g. Sprint 12 metadata"
          />
        </div>
        <div>
          <Label>Test level</Label>
          <Select
            value={w.form.testLevel}
            onChange={(e) => w.setForm({ ...w.form, testLevel: e.target.value as typeof w.form.testLevel })}
          >
            {TEST_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mb-4">
        <Label>Notes</Label>
        <textarea
          className="w-full min-h-[4rem] rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          value={w.form.deploymentNotes}
          onChange={(e) => w.setForm({ ...w.form, deploymentNotes: e.target.value })}
          placeholder="Optional deployment notes"
        />
      </div>

      {deployableItems.some((r) => r.metadataType === 'Profile') && (
        <InlineAlert variant="warning" className="mb-3">
          Profile metadata selected — deploy may take significant time.
        </InlineAlert>
      )}

      <div className="border border-border/60 rounded-md max-h-40 overflow-auto mb-4">
        <table className="w-full text-[10px]">
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              <th className="p-1.5 text-left">Name</th>
              <th className="p-1.5 text-left">Type</th>
              <th className="p-1.5 text-left">Diff</th>
            </tr>
          </thead>
          <tbody>
            {deployableItems.slice(0, 50).map((row) => (
              <tr key={itemKey(row.metadataType, row.fullName)} className="border-t border-border">
                <td className="p-1.5 font-mono">{row.fullName}</td>
                <td className="p-1.5 text-muted-foreground">{row.metadataType}</td>
                <td className="p-1.5">{DIFF_TYPE_LABELS[row.diffType]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {deployableItems.length > 50 && (
          <p className="text-[10px] text-muted-foreground p-2">+ {deployableItems.length - 50} more</p>
        )}
      </div>

      {w.packageXmlPreview && (
        <details className="mb-4">
          <summary className="text-xs cursor-pointer text-muted-foreground">View package.xml</summary>
          <pre className="text-[10px] font-mono bg-secondary/30 rounded p-2 max-h-32 overflow-auto border border-border mt-1">
            {w.packageXmlPreview}
          </pre>
        </details>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => void w.deploy()}
          loading={w.deploying || w.phase === 'deploying'}
          disabled={deployableCount === 0 || w.isRunning}
        >
          Deploy now ({deployableCount})
        </Button>
      </div>
    </FormSection>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
