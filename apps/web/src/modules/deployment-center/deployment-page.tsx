'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';
import { fetchOrgsList } from '@/hooks/use-orgs';
import {
  applyApprovalPending,
  reconcileApproval,
  reconcileApprovalFailure,
  type OptimisticDeployment,
} from './optimistic-deployments';
import { EntityRequestGate } from '@/lib/optimistic-list';

interface Org { id: string; alias: string }
interface Deployment { id: string; repo: string; branch: string; status: string; strategy: string }

export default function DeploymentCenterPage({ strategy }: { strategy: 'azure' | 'jenkins' }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [repos, setRepos] = useState<Array<{ id: string; name: string; project?: string }>>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [deployments, setDeployments] = useState<OptimisticDeployment<Deployment>[]>([]);
  const [form, setForm] = useState({ targetOrgId: '', repo: '', branch: '' });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState<Record<string, boolean>>({});
  const [approvalErrors, setApprovalErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState('');
  const approvalGateRef = useRef(new EntityRequestGate());

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
    const snapshot = deployments.find((deployment) => deployment.id === id);
    if (!snapshot) return;
    const token = approvalGateRef.current.begin(id);
    if (token == null) return;
    setApprovalBusy((current) => ({ ...current, [id]: true }));
    setApprovalErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setDeployments((current) => applyApprovalPending(current, id));
    setAnnouncement(`Deployment ${id} approval is queued.`);
    try {
      const updated = await api<Deployment>(`/deployments/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
      });
      if (!approvalGateRef.current.isLatest(id, token)) return;
      setDeployments((current) => reconcileApproval(current, id, updated));
      setAnnouncement(`Deployment ${id} approval was accepted.`);
    } catch (error) {
      if (!approvalGateRef.current.isLatest(id, token)) return;
      const authoritative = await api<Deployment[]>('/deployments').catch(() => null);
      const failure = error instanceof Error ? error.message : 'Approve failed';
      const { disposition } = reconcileApprovalFailure([], id, authoritative);
      setDeployments((current) => {
        const reconciled = reconcileApprovalFailure(current, id, authoritative);
        return reconciled.deployments;
      });
      setApprovalErrors((current) => ({
        ...current,
        [id]: disposition === 'rolled_back'
          ? `${failure} The authoritative pending state was restored.`
          : disposition === 'reconciled'
            ? `${failure} The current server state is shown.`
            : `${failure} The server state could not be confirmed; queued state is retained.`,
      }));
      setAnnouncement(disposition === 'rolled_back'
        ? `Deployment ${id} approval failed and was rolled back.`
        : disposition === 'reconciled'
          ? `Deployment ${id} approval response failed; server state was reconciled.`
          : `Deployment ${id} approval response failed; server state is unconfirmed.`);
    } finally {
      if (approvalGateRef.current.finish(id, token)) {
        setApprovalBusy((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      }
    }
  };

  const title = strategy === 'azure' ? 'Azure DevOps' : 'Jenkins';

  return (
    <div className="p-4 md:p-6 space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
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
                <Label htmlFor="deployment-target-org">Target Org</Label>
                <Select id="deployment-target-org" value={form.targetOrgId} onChange={(e) => setForm({ ...form, targetOrgId: e.target.value })}>
                  <option value="">Select...</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.alias}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="deployment-repository">Repository</Label>
                <Select id="deployment-repository" value={form.repo} onChange={(e) => { setForm({ ...form, repo: e.target.value }); loadBranches(e.target.value); }}>
                  <option value="">Select...</option>
                  {repos.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.project ? `${r.name} (${r.project})` : r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="deployment-branch">Branch</Label>
                <Select id="deployment-branch" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
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
              <div key={d.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-border" aria-busy={Boolean(approvalBusy[d.id])}>
                <div>
                  <p className="text-sm font-medium break-all">{d.repo} / {d.branch}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.status}{d.approvalPending ? ' · Approval pending…' : ''}
                  </p>
                  {approvalErrors[d.id] && (
                    <p role="alert" className="text-xs text-destructive">
                      {approvalErrors[d.id]}
                    </p>
                  )}
                </div>
                {d.status === 'pending' && (
                  <Button
                    size="sm"
                    loading={Boolean(approvalBusy[d.id])}
                    disabled={Boolean(approvalBusy[d.id])}
                    onClick={() => void approve(d.id)}
                    className="self-start sm:self-auto"
                  >
                    Approve
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
