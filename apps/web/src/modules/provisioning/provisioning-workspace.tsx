'use client';

import { useEffect, useState } from 'react';
import { FileSpreadsheet, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label, Select, Textarea } from '@/components/ui/input';
import { FormSection, GlassCard, InlineAlert } from '@/components/studio';
import { cn } from '@/utils/cn';
import { ConaUserProvisioningForm } from './cona-user-provisioning-form';
import { ProvisioningPageHeader } from './provisioning-page-header';
import { api } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';

interface Org {
  id: string;
  alias: string;
}

const SAMPLE_CSV = `firstName,lastName,email,username,profile,permissionSets
John,Doe,john.doe@example.com,john.doe@example.com.scratch,Standard User,Admin
Jane,Smith,jane.smith@example.com,jane.smith@example.com.scratch,Standard User,Admin`;

type Tab = 'cona' | 'csv';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/25',
      )}
    >
      {children}
    </button>
  );
}

export function ProvisioningWorkspace() {
  const [tab, setTab] = useState<Tab>('cona');
  const { orgs } = useOrgs();
  const [orgId, setOrgId] = useState('');
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [parsed, setParsed] = useState<unknown[]>([]);
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; variant: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setParsed([]);
    setMessage(null);
  }, [csv]);

  const parseCsv = async () => {
    setParsing(true);
    setMessage(null);
    try {
      const users = await api<unknown[]>('/provisioning/parse-csv', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      setParsed(users);
      setMessage({ text: `${users.length} users parsed`, variant: 'success' });
    } catch (err) {
      setParsed([]);
      setMessage({
        text: err instanceof Error ? err.message : 'CSV parsing failed',
        variant: 'error',
      });
    } finally {
      setParsing(false);
    }
  };

  const provision = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const users = await api<unknown[]>('/provisioning/parse-csv', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      const res = await api<{ batchId: string; totalUsers: number }>('/provisioning/bulk', {
        method: 'POST',
        body: JSON.stringify({ orgId, users }),
      });
      setMessage({
        text: `Provisioning ${res.totalUsers} users (batch: ${res.batchId})`,
        variant: 'success',
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Provisioning failed',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <ProvisioningPageHeader />

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'cona'} onClick={() => setTab('cona')}>
          <Users className="w-4 h-4" />
          CONA users
        </TabButton>
        <TabButton active={tab === 'csv'} onClick={() => setTab('csv')}>
          <FileSpreadsheet className="w-4 h-4" />
          CSV bulk
        </TabButton>
      </div>

      {tab === 'cona' ? (
        <GlassCard title="CONA onboarding users" description="Discover picklists and provision users with roles and modules.">
          <ConaUserProvisioningForm embedded />
        </GlassCard>
      ) : (
        <GlassCard title="CSV bulk upload" description="Import users from a CSV file with profiles and permission sets.">
          <FormSection title="CSV import">
            <div>
              <Label htmlFor="provisioning-csv-target-org">Target Org</Label>
              <Select id="provisioning-csv-target-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.alias}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="provisioning-csv-data">CSV Data</Label>
              <Textarea
                id="provisioning-csv-data"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                className="font-mono text-xs h-52 studio-console overflow-y-auto resize-none"
              />
            </div>
          </FormSection>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => void parseCsv()} loading={parsing}>
              Parse CSV
            </Button>
            <Button onClick={() => void provision()} loading={loading} disabled={!orgId}>
              Provision Users
            </Button>
          </div>
          {parsed.length > 0 && (
            <p className="text-sm text-muted-foreground mt-3">{parsed.length} users parsed</p>
          )}
          {message && (
            <InlineAlert variant={message.variant} className="mt-4">
              {message.text}
            </InlineAlert>
          )}
        </GlassCard>
      )}
    </div>
  );
}
