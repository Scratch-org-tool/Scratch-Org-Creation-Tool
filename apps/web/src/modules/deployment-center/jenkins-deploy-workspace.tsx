'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { Wrench } from 'lucide-react';
import {
  DeploymentPageHeader,
  FormSection,
  GlassCard,
  InlineAlert,
  ListRow,
  ListRowGroup,
  StatusBadge,
} from '@/components/studio';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';

interface Org {
  id: string;
  alias: string;
}
interface Deployment {
  id: string;
  repo: string;
  branch: string;
  status: string;
  strategy: string;
}

export function JenkinsDeployWorkspace() {
  const strategy = 'jenkins' as const;
  const { orgs } = useOrgs();
  const [repos, setRepos] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [form, setForm] = useState({ targetOrgId: '', repo: '', branch: '' });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branchRequestRef = useRef(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<Deployment[]>('/deployments'),
      api<Array<{ id: string; name: string }>>(`/deployments/repos?strategy=${strategy}`),
    ])
      .then(([d, r]) => {
        setDeployments(d);
        setRepos(r);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const loadBranches = async (repo: string) => {
    const request = ++branchRequestRef.current;
    setBranches([]);
    setForm((current) => ({ ...current, repo, branch: '' }));
    if (!repo) return;
    try {
      const b = await api<string[]>(
        `/deployments/branches?strategy=${strategy}&repo=${encodeURIComponent(repo)}`,
      );
      if (branchRequestRef.current === request) setBranches(b);
    } catch (err) {
      if (branchRequestRef.current === request) {
        setError(err instanceof Error ? err.message : 'Failed to load branches');
      }
    }
  };

  const createDeployment = async () => {
    setCreating(true);
    setError(null);
    try {
      await api('/deployments', {
        method: 'POST',
        body: JSON.stringify({ ...form, strategy }),
      });
      const updated = await api<Deployment[]>('/deployments');
      setDeployments(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deployment');
    } finally {
      setCreating(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await api(`/deployments/${id}/approve`, {
        method: 'POST',
      });
      const updated = await api<Deployment[]>('/deployments');
      setDeployments(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  const jenkinsDeployments = deployments.filter((d) => d.strategy === strategy);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DeploymentPageHeader
        title="Jenkins Deployment Center"
        subtitle="Trigger Jenkins builds and deploy metadata to Salesforce orgs."
        icon={Wrench}
        accentClass="to-orange-500/10"
        showBreadcrumbs
      />

      {error && (
        <InlineAlert variant="error" onDismiss={() => setError(null)}>
          {error}
        </InlineAlert>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <GlassCard title="New Deployment" description="Select target org, job repo, and branch.">
          <FormSection title="Deployment target">
            <div>
              <Label>Target Org</Label>
              <Select
                value={form.targetOrgId}
                onChange={(e) => setForm({ ...form, targetOrgId: e.target.value })}
              >
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.alias}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Repository</Label>
              <Select
                value={form.repo}
                onChange={(e) => {
                  void loadBranches(e.target.value);
                }}
              >
                <option value="">Select…</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Branch</Label>
              <Select
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              >
                <option value="">Select…</option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              onClick={createDeployment}
              loading={creating}
              disabled={!form.targetOrgId || !form.repo || !form.branch}
            >
              Create Deployment
            </Button>
          </FormSection>
        </GlassCard>

        <GlassCard title="Recent Deployments" description="Jenkins-triggered deployment runs.">
          <ListRowGroup emptyMessage="No Jenkins deployments yet.">
            {jenkinsDeployments.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <ListRow
                  className="flex-1 border-0"
                  title={`${d.repo} / ${d.branch}`}
                  status={d.status}
                />
                {d.status === 'pending' && (
                  <Button size="sm" onClick={() => void approve(d.id)}>
                    Approve
                  </Button>
                )}
              </div>
            ))}
          </ListRowGroup>
        </GlassCard>
      </div>
      )}
    </div>
  );
}
