'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import {
  FormSection,
  InlineAlert,
  ListRow,
  ListRowGroup,
  StatusBadge,
} from '@/components/studio';
import {
  ORG_TO_ORG_RECORD_LIMIT_MAX,
  extractLimitFromSoql,
  replaceOrApplyLimit,
  DATA_DEPLOY_CHUNK_SIZE,
  DATA_PREVIEW_MAX_ROWS,
  shouldChunkDeploy,
  chunkCountForLimit,
} from '@sfcc/shared';
import { api } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';
import { DataDeployBatchProgress } from './data-deploy-batch-progress';
import { DataPreviewTable } from './data-preview-table';
import type { Org } from './types';

interface JobData {
  id: string;
  status: string;
  error?: string | null;
  logs?: Array<{ stream: string; line: string; timestamp: string }>;
}

interface Movement {
  id: string;
  objectName: string | null;
  status: string;
  recordCount: number | null;
  movementType: string;
  createdAt: string;
  sourceOrg: { alias: string };
  targetOrg: { alias: string };
}

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

export function GenericDeployPanel() {
  const { orgs } = useOrgs();
  const [form, setForm] = useState({
    sourceOrgId: '',
    targetOrgId: '',
    objectName: 'Account',
    soql: '',
    recordLimit: 200,
  });
  const [preview, setPreview] = useState<{
    records: unknown[];
    totalSize: number;
    previewCapped?: boolean;
    previewLimit?: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [movementId, setMovementId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [movement, setMovement] = useState<Movement | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [deployError, setDeployError] = useState<string | null>(null);
  const logBottomRef = useRef<HTMLDivElement>(null);
  const previewRequestRef = useRef(0);

  const loadMovements = useCallback(() => {
    api<Movement[]>('/data/movements')
      .then((list) => setMovements(list.filter((m) => m.movementType === 'deploy')))
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const data = await api<JobData>(`/jobs/${jobId}`);
        setJob(data);
        if (data.logs?.length) {
          setLogs(data.logs.map((l) => l.line));
        }
        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(poll);
          loadMovements();
        }
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [jobId, loadMovements]);

  useEffect(() => {
    if (!movementId) return;
    const poll = setInterval(async () => {
      try {
        const data = await api<Movement>(`/data/movements/${movementId}`);
        setMovement(data);
        if (TERMINAL_STATUSES.includes(data.status)) clearInterval(poll);
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [movementId]);

  const previewSoql = replaceOrApplyLimit(
    form.soql?.trim() || `SELECT Id, Name FROM ${form.objectName}`,
    form.recordLimit,
  );

  const handlePreview = async () => {
    if (!form.sourceOrgId) return;
    const request = ++previewRequestRef.current;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await api<{
        records: unknown[];
        totalSize: number;
        previewCapped?: boolean;
        previewLimit?: number;
      }>(
        `/data/preview?sourceOrgId=${form.sourceOrgId}&soql=${encodeURIComponent(previewSoql)}&recordLimit=${form.recordLimit}`,
      );
      if (previewRequestRef.current === request) setPreview(res);
    } catch (err) {
      if (previewRequestRef.current === request) {
        setPreview(null);
        setPreviewError(err instanceof Error ? err.message : 'Preview failed');
      }
    } finally {
      if (previewRequestRef.current === request) setPreviewLoading(false);
    }
  };

  useEffect(() => {
    previewRequestRef.current += 1;
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, [form.sourceOrgId, form.objectName, form.soql, form.recordLimit]);

  const handleDeploy = async () => {
    if (form.sourceOrgId === form.targetOrgId) {
      setDeployError('Source and target org must differ.');
      return;
    }
    setLoading(true);
    setLogs([]);
    setJob(null);
    setMovement(null);
    setBatchId(null);
    setDeployError(null);
    try {
      const res = await api<{
        movementId: string;
        jobId: string;
        status: string;
        batchId?: string;
        totalChunks?: number;
      }>('/data/deploy', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setJobId(res.jobId);
      setMovementId(res.movementId);
      setBatchId(res.batchId ?? null);
      setJob({ id: res.jobId, status: res.status });
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setLoading(false);
    }
  };

  const willChunk = shouldChunkDeploy(form.recordLimit);
  const chunkCount = chunkCountForLimit(form.recordLimit);

  const deployStatus = movement?.status ?? job?.status;
  const isRunning = deployStatus === 'running' || deployStatus === 'queued' || loading;

  return (
    <div className="space-y-6">
      {deployError && (
        <InlineAlert variant="error" onDismiss={() => setDeployError(null)}>
          {deployError}
        </InlineAlert>
      )}
      {previewError && (
        <InlineAlert variant="error" onDismiss={() => setPreviewError(null)}>
          {previewError}
        </InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <FormSection title="Job configuration">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Source Org</Label>
              <Select value={form.sourceOrgId} onChange={(e) => setForm({ ...form, sourceOrgId: e.target.value })}>
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.alias}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Target Org</Label>
              <Select value={form.targetOrgId} onChange={(e) => setForm({ ...form, targetOrgId: e.target.value })}>
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.alias}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Object</Label>
            <Input value={form.objectName} onChange={(e) => setForm({ ...form, objectName: e.target.value })} />
          </div>
          <div>
            <Label>Maximum records to deploy</Label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Input
                type="number"
                min={1}
                max={ORG_TO_ORG_RECORD_LIMIT_MAX}
                value={form.recordLimit}
                onChange={(e) => {
                  const recordLimit = Math.min(
                    ORG_TO_ORG_RECORD_LIMIT_MAX,
                    Math.max(1, Number(e.target.value) || 200),
                  );
                  setForm((f) => ({
                    ...f,
                    recordLimit,
                    soql: f.soql
                      ? replaceOrApplyLimit(f.soql, recordLimit)
                      : f.soql,
                  }));
                }}
                className="w-28"
              />
              <span className="text-xs text-muted-foreground">
                up to {ORG_TO_ORG_RECORD_LIMIT_MAX.toLocaleString()} records
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Preview is capped at 2,000 rows; deploy uses the full limit you set here.
            </p>
            {willChunk && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                Will run as {chunkCount} load-balanced chunks of up to{' '}
                {DATA_DEPLOY_CHUNK_SIZE.toLocaleString()} records each.
              </p>
            )}
            {form.recordLimit > 10_000 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Large generic bulk deploys may hit validation errors — prefer org-to-org upsert (SFDMU) for
                complex objects.
              </p>
            )}
          </div>
          <div>
            <Label>SOQL (optional)</Label>
            <Textarea
              value={form.soql}
              onChange={(e) => {
                const soql = e.target.value;
                const parsedLimit = extractLimitFromSoql(soql);
                setForm((f) => ({
                  ...f,
                  soql,
                  ...(parsedLimit != null ? { recordLimit: parsedLimit } : {}),
                }));
              }}
              placeholder={`SELECT Name, Industry FROM ${form.objectName}`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Id is stripped on export. Deploy limit replaces any LIMIT in your SOQL.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => void handlePreview()}
              disabled={!form.sourceOrgId || previewLoading}
              loading={previewLoading}
            >
              Preview Data
            </Button>
            <Button
              onClick={() => void handleDeploy()}
              loading={loading}
              disabled={
                isRunning
                || !form.sourceOrgId
                || !form.targetOrgId
                || form.sourceOrgId === form.targetOrgId
              }
            >
              Deploy
            </Button>
          </div>
          {preview && (
            <div className="mt-4">
              <DataPreviewTable
                records={preview.records}
                totalSize={preview.totalSize}
                maxRows={DATA_PREVIEW_MAX_ROWS}
                previewCapped={preview.previewCapped}
                previewLimit={preview.previewLimit}
              />
            </div>
          )}
        </FormSection>

        <div className="rounded-lg border border-border/60 p-4 space-y-4">
          {batchId && <DataDeployBatchProgress batchId={batchId} onTerminal={loadMovements} />}
          <p className="text-sm font-medium">{jobId ? 'Deployment progress' : 'Live console'}</p>
          {job?.error && <InlineAlert variant="error">{job.error}</InlineAlert>}
          <div className="studio-console rounded-lg overflow-hidden mt-2">
            <div className="px-3 py-2 border-b border-border/60 text-muted-foreground text-xs">
              CLI output (export → import)
            </div>
            <div className="h-64 overflow-y-auto p-3 space-y-0.5 text-xs">
              {!jobId && <p className="text-muted-foreground">Start a deploy to see CLI output here.</p>}
              {logs.length === 0 && jobId && (
                <p className="text-muted-foreground">Waiting for bulk export/import output…</p>
              )}
              {logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              <div ref={logBottomRef} />
            </div>
          </div>
          {deployStatus && (
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={deployStatus} />
              {movement?.recordCount != null && deployStatus === 'completed' && (
                <span className="text-sm text-muted-foreground">{movement.recordCount} record(s)</span>
              )}
            </div>
          )}
        </div>
      </div>

      <FormSection title="Recent deployments">
        <ListRowGroup emptyMessage="No deployments yet.">
          {movements.map((m) => (
            <ListRow
              key={m.id}
              title={m.objectName ?? 'Data deploy'}
              subtitle={`${m.sourceOrg.alias} → ${m.targetOrg.alias}`}
              status={m.status}
              trailing={
                <span className="text-xs text-muted-foreground shrink-0">
                  {m.recordCount ?? '—'} · {new Date(m.createdAt).toLocaleDateString()}
                </span>
              }
            />
          ))}
        </ListRowGroup>
      </FormSection>
    </div>
  );
}
