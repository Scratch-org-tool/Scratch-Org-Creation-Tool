'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { FormSection, GlassCard, InlineAlert, StatusBadge } from '@/components/studio';
import { api, getStreamUrl } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';
import { Plus, Trash2 } from 'lucide-react';

interface Org {
  id: string;
  alias: string;
}

type AccountGroup = 'Z001' | 'ZFSV' | 'Z003';
type Bottler = '5000' | '4900' | '4600';
type DistributionChannel = 'Z1' | 'Z3';
type Dataset = 'OnboardingConfig' | 'Products' | 'VisitPlans' | 'Accounts';

interface AccountSeedRow {
  accountGroup: AccountGroup;
  bottler: Bottler;
  distributionChannel: DistributionChannel;
  limit: number;
}

interface JobData {
  id: string;
  status: string;
  error?: string | null;
  logs?: Array<{ line: string }>;
}

const DATASETS: Dataset[] = ['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'];

const DEFAULT_ACCOUNT_ROW: AccountSeedRow = {
  accountGroup: 'Z001',
  bottler: '5000',
  distributionChannel: 'Z1',
  limit: 500,
};

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

function isZfsv5000Blocked(row: AccountSeedRow) {
  return row.accountGroup === 'ZFSV' && row.bottler === '5000';
}

export function ConaSeedDeploymentForm({ embedded }: { embedded?: boolean } = {}) {
  const { orgs } = useOrgs();
  const [sourceOrgId, setSourceOrgId] = useState('');
  const [targetOrgId, setTargetOrgId] = useState('');
  const [datasets, setDatasets] = useState<Dataset[]>([...DATASETS]);
  const [accountRows, setAccountRows] = useState<AccountSeedRow[]>([{ ...DEFAULT_ACCOUNT_ROW }]);
  const [preview, setPreview] = useState<{
    ok?: boolean;
    checks?: Array<{ dataset: string; count: number; ok: boolean }>;
    rows?: Array<AccountSeedRow & { availableCount: number; soql: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const data = await api<JobData>(`/jobs/${jobId}`);
        setJob(data);
        if (data.logs?.length) setLogs(data.logs.map((l) => l.line));
        if (TERMINAL_STATUSES.includes(data.status)) clearInterval(poll);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    let es: EventSource | null = null;
    let cancelled = false;
    void (async () => {
      const url = await getStreamUrl(['job_log', 'job_status']);
      if (cancelled) return;
      es = new EventSource(url);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            payload: { jobId?: string; line?: string; status?: string };
          };
          if (data.payload.jobId !== jobId) return;
          if (data.type === 'job_log' && data.payload.line) {
            setLogs((l) => [...l, data.payload.line!]);
          }
          if (data.type === 'job_status' && data.payload.status) {
            setJob((j) => (j ? { ...j, status: data.payload.status! } : j));
          }
        } catch { /* ignore */ }
      };
    })();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [jobId]);

  const accountSeedPayload = datasets.includes('Accounts') ? accountRows : undefined;

  const validateRows = useCallback(() => {
    const blocked = accountRows.find(isZfsv5000Blocked);
    if (blocked) {
      throw new Error('ZFSV accounts are not available for bottler 5000');
    }
  }, [accountRows]);

  const handlePreview = async () => {
    if (!sourceOrgId || !targetOrgId) return;
    setError(null);
    setLoading(true);
    try {
      validateRows();
      const [validation, accountPreview] = await Promise.all([
        api<{ ok: boolean; checks: Array<{ dataset: string; count: number; ok: boolean }> }>(
          '/data/seed/preview',
          {
            method: 'POST',
            body: JSON.stringify({
              sourceOrgId,
              targetOrgId,
              datasets,
              accountSeedRows: accountSeedPayload,
            }),
          },
        ),
        datasets.includes('Accounts')
          ? api<{ rows: Array<AccountSeedRow & { availableCount: number; soql: string }> }>(
              '/data/account-seed/preview',
              {
                method: 'POST',
                body: JSON.stringify({ sourceOrgId, rows: accountRows }),
              },
            )
          : Promise.resolve(null),
      ]);
      setPreview({ ok: validation.ok, checks: validation.checks, rows: accountPreview?.rows });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (!sourceOrgId || !targetOrgId) return;
    setError(null);
    setLoading(true);
    setLogs([]);
    setJob(null);
    setJobId(null);
    try {
      validateRows();
      const res = await api<{ jobId: string }>('/data/seed/run', {
        method: 'POST',
        body: JSON.stringify({
          sourceOrgId,
          targetOrgId,
          datasets,
          accountSeedRows: accountSeedPayload,
        }),
      });
      setJobId(res.jobId);
      setJob({ id: res.jobId, status: 'queued' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed run failed');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (index: number, patch: Partial<AccountSeedRow>) => {
    setAccountRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const isRunning = job?.status === 'running' || job?.status === 'queued' || loading;

  const formContent = (
    <>
        <FormSection title="Orgs">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Source Org</Label>
              <Select value={sourceOrgId} onChange={(e) => setSourceOrgId(e.target.value)}>
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.alias}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Target Org</Label>
              <Select value={targetOrgId} onChange={(e) => setTargetOrgId(e.target.value)}>
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.alias}</option>
                ))}
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Datasets" className="mt-6">
          <div className="flex flex-wrap gap-3">
            {DATASETS.map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={datasets.includes(d)}
                  onChange={(e) => {
                    setDatasets((prev) =>
                      e.target.checked ? [...prev, d] : prev.filter((x) => x !== d),
                    );
                  }}
                />
                {d}
              </label>
            ))}
          </div>
        </FormSection>

        {datasets.includes('Accounts') && (
          <FormSection title="Account seed rows" className="mt-6">
            <p className="text-xs text-muted-foreground mb-3">
              Each row builds a SOQL query by account group, bottler, and distribution channel. ZFSV + bottler 5000 is blocked.
            </p>
            <div className="space-y-3">
              {accountRows.map((row, index) => (
                <div
                  key={index}
                  className={`grid gap-2 md:grid-cols-6 items-end p-3 rounded-lg border ${
                    isZfsv5000Blocked(row) ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                  }`}
                >
                  <div>
                    <Label>Group</Label>
                    <Select
                      value={row.accountGroup}
                      onChange={(e) => updateRow(index, { accountGroup: e.target.value as AccountGroup })}
                    >
                      <option value="Z001">Z001</option>
                      <option value="ZFSV">ZFSV</option>
                      <option value="Z003">Z003</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Bottler</Label>
                    <Select
                      value={row.bottler}
                      onChange={(e) => updateRow(index, { bottler: e.target.value as Bottler })}
                    >
                      <option value="5000">5000</option>
                      <option value="4900">4900</option>
                      <option value="4600">4600</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Channel</Label>
                    <Select
                      value={row.distributionChannel}
                      onChange={(e) =>
                        updateRow(index, { distributionChannel: e.target.value as DistributionChannel })
                      }
                    >
                      <option value="Z1">Z1</option>
                      <option value="Z3">Z3</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Limit</Label>
                    <Input
                      type="number"
                      min={1}
                      value={row.limit}
                      onChange={(e) => updateRow(index, { limit: Number(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    {accountRows.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setAccountRows((rows) => rows.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-1"
              onClick={() => setAccountRows((rows) => [...rows, { ...DEFAULT_ACCOUNT_ROW }])}
            >
              <Plus className="w-4 h-4" />
              Add account row
            </Button>
          </FormSection>
        )}

        {error && (
          <InlineAlert variant="error" className="mt-4" onDismiss={() => setError(null)}>
            {error}
          </InlineAlert>
        )}

        <div className="flex flex-wrap gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => void handlePreview()}
            disabled={!sourceOrgId || !targetOrgId || isRunning}
            loading={loading && !jobId}
          >
            Preview / validate
          </Button>
          <Button
            onClick={() => void handleRun()}
            disabled={!sourceOrgId || !targetOrgId || isRunning}
            loading={loading && !!jobId}
          >
            Run CONA seed
          </Button>
        </div>

        {preview && (
          <div className="mt-4 space-y-3">
            <InlineAlert variant={preview.ok ? 'success' : 'warning'} title="Validation">
              {preview.ok ? 'Source org has enough records for selected datasets.' : 'Some checks failed — review counts below.'}
            </InlineAlert>
            {preview.checks && (
              <ul className="text-xs space-y-1 font-mono">
                {preview.checks.map((c) => (
                  <li key={c.dataset} className={c.ok ? 'text-muted-foreground' : 'text-amber-600'}>
                    {c.dataset}: {c.count} {c.ok ? '✓' : '✗'}
                  </li>
                ))}
              </ul>
            )}
            {preview.rows?.map((row, i) => (
              <details key={i} className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Row {i + 1}: {row.accountGroup}/{row.bottler}/{row.distributionChannel} — {row.availableCount} available
                </summary>
                <pre className="studio-console p-2 mt-1 rounded overflow-x-auto">{row.soql}</pre>
              </details>
            ))}
          </div>
        )}
    </>
  );

  const jobProgress = jobId ? (
    <div className="rounded-lg border border-border/60 p-4 mt-4">
      <p className="text-sm font-medium mb-3">Seed job progress</p>
      {job?.error && <InlineAlert variant="error">{job.error}</InlineAlert>}
      <div className="studio-console rounded-lg overflow-hidden mt-2">
        <div className="px-3 py-2 border-b border-border/60 text-muted-foreground text-xs">
          Export → import log
        </div>
        <div className="h-48 overflow-y-auto p-3 space-y-0.5 text-xs">
          {logs.length === 0 && <p className="text-muted-foreground">Waiting for output…</p>}
          {logs.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          <div ref={logBottomRef} />
        </div>
      </div>
      {job?.status && (
        <div className="mt-2">
          <StatusBadge status={job.status} />
        </div>
      )}
    </div>
  ) : null;

  if (embedded) {
    return (
      <>
        {formContent}
        {jobProgress}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard
        title="CONA Data Seed"
        description="Validate, export, and import onboarding config, products, visit plans, and account slices using dynamic SOQL."
      >
        {formContent}
      </GlassCard>
      {jobProgress}
    </div>
  );
}
