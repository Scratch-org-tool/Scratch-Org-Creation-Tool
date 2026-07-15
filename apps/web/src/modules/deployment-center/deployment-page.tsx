'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';
import { fetchOrgsList } from '@/hooks/use-orgs';

interface Org { id: string; alias: string }
interface Deployment { id: string; repo: string; branch: string; status: string; strategy: string }

export default function DeploymentCenterPage({ strategy }: { strategy: 'azure' | 'jenkins' }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [repos, setRepos] = useState<Array<{ id: string; name: string; project?: string }>>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [form, setForm] = useState({ targetOrgId: '', repo: '', branch: '' });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchOrgsList(),
      api<Deployment[]>('/deployments'),
      api<Array<{ id: string; name: string; project?: string }>>(`/deployments/repos?strategy=${strategy}`),
    ])
      .then(([o, d, r]) => {
        setOrgs(o);
        setDeployments(d);
        setRepos(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [strategy]);

  const loadBranches = async (repo: string) => {
    const b = await api<string[]>(`/deployments/branches?strategy=${strategy}&repo=${repo}`);
    setBranches(b);
  };

  const createDeployment = async () => {
    setCreating(true);
    try {
      await api('/deployments', {
        method: 'POST',
        body: JSON.stringify({ ...form, strategy }),
      });
      const updated = await api<Deployment[]>('/deployments');
      setDeployments(updated);
    } finally {
      setCreating(false);
    }
  };

  const approve = async (id: string) => {
    await api(`/deployments/${id}/approve`, {
      method: 'POST',
    });
    const updated = await api<Deployment[]>('/deployments');
    setDeployments(updated);
  };

  const title = strategy === 'azure' ? 'Azure DevOps' : 'Jenkins';

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">Manage deployments via {title}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New Deployment</CardTitle></CardHeader>
        <CardContent className="space-y-4 max-w-lg">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div>
                <Label>Target Org</Label>
                <Select value={form.targetOrgId} onChange={(e) => setForm({ ...form, targetOrgId: e.target.value })}>
                  <option value="">Select...</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.alias}</option>)}
                </Select>
              </div>
              <div>
                <Label>Repository</Label>
                <Select value={form.repo} onChange={(e) => { setForm({ ...form, repo: e.target.value }); loadBranches(e.target.value); }}>
                  <option value="">Select...</option>
                  {repos.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.project ? `${r.name} (${r.project})` : r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                  <option value="">Select...</option>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
              <Button onClick={createDeployment} loading={creating} disabled={!form.targetOrgId || !form.repo || !form.branch}>
                Create Deployment
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Deployments</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : (
            deployments.filter((d) => d.strategy === strategy).map((d) => (
              <div key={d.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-border">
                <div>
                  <p className="text-sm font-medium break-all">{d.repo} / {d.branch}</p>
                  <p className="text-xs text-muted-foreground">{d.status}</p>
                </div>
                {d.status === 'pending' && (
                  <Button size="sm" onClick={() => approve(d.id)} className="self-start sm:self-auto">Approve</Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
