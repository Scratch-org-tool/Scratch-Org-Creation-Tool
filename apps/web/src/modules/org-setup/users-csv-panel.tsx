'use client';

import { Button } from '@/components/ui/button';
import { Label, Select, Textarea } from '@/components/ui/input';
import { FormSection, InlineAlert } from '@/components/studio';
import type { OrgSetupWorkspaceState } from './use-org-setup-workspace';

interface UsersCsvPanelProps {
  w: OrgSetupWorkspaceState;
}

export function UsersCsvPanel({ w }: UsersCsvPanelProps) {
  return (
    <>
      <FormSection title="CSV import">
        <div>
          <Label>Target Org</Label>
          <Select value={w.csvOrgId} onChange={(e) => w.setCsvOrgId(e.target.value)}>
            <option value="">Select…</option>
            {w.orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.alias}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>CSV Data</Label>
          <Textarea
            value={w.csv}
            onChange={(e) => w.setCsv(e.target.value)}
            className="font-mono text-xs h-52 studio-console overflow-y-auto resize-none"
          />
        </div>
      </FormSection>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" onClick={() => void w.parseCsv()}>
          Parse CSV
        </Button>
        <Button onClick={() => void w.provisionCsv()} loading={w.csvLoading} disabled={!w.csvOrgId}>
          Provision Users
        </Button>
      </div>
      {w.csvParsed.length > 0 && (
        <p className="text-sm text-muted-foreground mt-3">{w.csvParsed.length} users parsed</p>
      )}
      {w.csvMessage && (
        <InlineAlert variant={w.csvMessage.variant} className="mt-4">
          {w.csvMessage.text}
        </InlineAlert>
      )}
    </>
  );
}
