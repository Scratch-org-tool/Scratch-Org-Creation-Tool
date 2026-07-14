'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import {
  FormSection,
  GlassCard,
  InlineAlert,
  ListRow,
  ListRowGroup,
  StatusBadge,
  relativeTime,
} from '@/components/studio';
import { SCRATCH_PERMISSION_SET } from '@sfcc/shared';
import type { OrgSetupWorkspaceState } from './use-org-setup-workspace';

interface BaselineSetupPanelProps {
  w: OrgSetupWorkspaceState;
}

export function BaselineSetupPanel({ w }: BaselineSetupPanelProps) {
  return (
    <div className="space-y-6">
      <InlineAlert variant="info" title="Permission set assignment">
        <p className="mb-2">
          Enter permission set <strong>API names</strong> (e.g.{' '}
          <code className="text-xs">{SCRATCH_PERMISSION_SET}</code>), not labels like &quot;Admin&quot;.
        </p>
        <p>
          <strong>All active users</strong> assigns each set to every active standard user in the
          org. <strong>Connected user only</strong> assigns to the default user for this org
          connection. For new users with profiles, use{' '}
          <Link href="/org-setup?tab=users-csv" className="text-primary hover:underline">
            CSV bulk
          </Link>{' '}
          or{' '}
          <Link href="/org-setup?tab=users-cona" className="text-primary hover:underline">
            CONA users
          </Link>
          .
        </p>
      </InlineAlert>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <GlassCard title="Target configuration" description="Permission sets and theme for the target org.">
          <FormSection title="Org and permission sets">
            <div className="grid gap-3">
              <div>
                <Label>Target Org</Label>
                <Select value={w.orgId} onChange={(e) => w.setOrgId(e.target.value)}>
                  <option value="">Select…</option>
                  {w.orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.alias}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Assign to</Label>
                <Select
                  value={w.assignScope}
                  onChange={(e) =>
                    w.setAssignScope(e.target.value as 'default_user' | 'all_active_users')
                  }
                >
                  <option value="all_active_users">All active standard users</option>
                  <option value="default_user">Connected default user only</option>
                </Select>
              </div>
              <div>
                <Label>Permission Sets (comma-separated API names)</Label>
                <Input
                  value={w.permissionSets}
                  onChange={(e) => w.setPermissionSets(e.target.value)}
                  placeholder={SCRATCH_PERMISSION_SET}
                />
                {w.availablePermSets.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Available in org:{' '}
                    {w.availablePermSets
                      .slice(0, 8)
                      .map((p) => p.name)
                      .join(', ')}
                    {w.availablePermSets.length > 8 ? '…' : ''}
                  </p>
                )}
              </div>
              <div>
                <Label>Theme</Label>
                <Select value={w.theme} onChange={(e) => w.setTheme(e.target.value)}>
                  <option value="lightning">Lightning</option>
                  <option value="classic">Classic</option>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Theme is logged only (not yet applied via API).</p>
              </div>
            </div>
          </FormSection>
          <Button
            onClick={() => void w.executeBaseline()}
            loading={w.baselineLoading}
            disabled={!w.orgId || w.isBaselineRunning}
            className="mt-4"
          >
            Execute Org Setup
          </Button>
          {w.baselineMessage && (
            <InlineAlert variant={w.baselineMessage.variant} className="mt-4">
              {w.baselineMessage.text}
            </InlineAlert>
          )}
        </GlassCard>

        <GlassCard title="Recent baseline runs" description="Permission set and theme setup runs for this org.">
          <ListRowGroup emptyMessage={w.orgId ? 'No runs yet.' : 'Select an org to see runs.'}>
            {w.runs.map((r) => (
              <ListRow
                key={r.id}
                title={r.setupType.replace(/_/g, ' ')}
                subtitle={relativeTime(r.createdAt)}
                status={r.status}
                trailing={<StatusBadge status={r.status} />}
              />
            ))}
          </ListRowGroup>
        </GlassCard>
      </div>

      {(w.baselineJobs.length > 0 || w.baselineStatus) && (
        <GlassCard title="Setup progress" description="Live output from permission set assignment on the API host.">
          {w.job?.error && (
            <InlineAlert variant="error" className="mb-3">
              {w.job.error}
            </InlineAlert>
          )}
          <div className="studio-console rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border/60 text-muted-foreground text-xs">
              CLI output
            </div>
            <div className="h-48 overflow-y-auto p-3 space-y-0.5 text-xs">
              {w.logs.length === 0 && (
                <p className="text-muted-foreground">Waiting for output…</p>
              )}
              {w.logs.map((line, i) => (
                <div key={`${i}-${line.slice(0, 12)}`}>{line}</div>
              ))}
              <div ref={w.logBottomRef} />
            </div>
          </div>
          {w.baselineStatus && (
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge status={w.baselineStatus} />
              {w.baselineStatus === 'completed' && (
                <span className="text-sm text-muted-foreground">
                  Permission sets assigned — verify in Setup → Users → Permission Set Assignments.
                </span>
              )}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
