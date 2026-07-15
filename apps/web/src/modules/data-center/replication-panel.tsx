'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import {
  FormSection,
  GlassCard,
  InlineAlert,
  ListRow,
  ListRowGroup,
  StatusBadge,
  relativeTime,
} from '@/components/studio';
import {
  ORG_TO_ORG_RECORD_LIMIT_MAX,
  replaceOrApplyLimit,
  DATA_DEPLOY_CHUNK_SIZE,
  DATA_PREVIEW_MAX_ROWS,
  shouldChunkDeploy,
  chunkCountForLimit,
} from '@sfcc/shared';
import { api } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';
import { DataPreviewTable } from './data-preview-table';
import { DataDeployBatchProgress } from './data-deploy-batch-progress';
import type { Org } from './types';

interface JobData {
  id: string;
  status: string;
  error?: string | null;
  logs?: Array<{ line: string }>;
}

interface Movement {
  id: string;
  status: string;
  createdAt: string;
  sourceOrg: { alias: string };
  targetOrg: { alias: string };
}

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

export function ReplicationPanel() {
  const { orgs } = useOrgs();
  const [form, setForm] = useState({
    sourceOrgId: '',
    targetOrgId: '',
    soql: 'SELECT Id, Name, cfs_ob__Status__c, RecordTypeId FROM cfs_ob__Onboarding_Config__c',
    recordLimit: 200,
  });
  const [preview, setPreview] = useState<{
    records: unknown[];
    totalSize: number;
    previewCapped?: boolean;
    previewLimit?: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [movementId, setMovementId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [movement, setMovement] = useState<Movement | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [replicateError, setReplicateError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const logBottomRef = useRef<HTMLDivElement>(null);

  const loadMovements = useCallback(async () => {
    try {
      const data = await api<Movement[]>('/data/movements?movementType=replication');
      setMovements(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadMovements();
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
        if (data.logs?.length) setLogs(data.logs.map((l) => l.line));
        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(poll);
          void loadMovements();
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

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await api<{
        records: unknown[];
        totalSize: number;
        previewCapped?: boolean;
        previewLimit?: number;
      }>(
        `/data/preview?sourceOrgId=${form.sourceOrgId}&soql=${encodeURIComponent(
          replaceOrApplyLimit(form.soql, form.recordLimit),
        )}&recordLimit=${form.recordLimit}`,
      );
      setPreview(res);
    } catch (err) {
      setReplicateError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleReplicate = async () => {
    if (form.sourceOrgId === form.targetOrgId) {
      setReplicateError('Source and target org must differ.');
      return;
    }
    setLoading(true);
    setLogs([]);
    setJob(null);
    setMovement(null);
    setBatchId(null);
    setReplicateError(null);
    setQueuedMessage(null);
    try {
      const res = await api<{
        movementId: string;
        jobId: string;
        batchId?: string;
        totalChunks?: number;
        preview: { totalSize: number };
        message?: string;
      }>('/data/replicate', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          soql: replaceOrApplyLimit(form.soql, form.recordLimit),
        }),
      });
      setJobId(res.jobId);
      setMovementId(res.movementId);
      setBatchId(res.batchId ?? null);
      setJob({ id: res.jobId, status: 'queued' });
      const chunkNote = res.totalChunks
        ? ` Running as ${res.totalChunks} load-balanced chunks.`
        : '';
      setQueuedMessage(
        `${res.message ?? 'Replication queued'} — SFDMU is copying ~${res.preview?.totalSize?.toLocaleString() ?? 0} record(s).${chunkNote}`,
      );
    } catch (err) {
      setReplicateError(err instanceof Error ? err.message : 'Replication failed');
    } finally {
      setLoading(false);
    }
  };

  const willChunk = shouldChunkDeploy(form.recordLimit);
  const chunkCount = chunkCountForLimit(form.recordLimit);

  const replicateStatus = movement?.status ?? job?.status;
  const isRunning =
    replicateStatus === 'running' || replicateStatus === 'queued' || replicateStatus === 'pending' || loading;

  return (
    <div className="space-y-6">
      {replicateError && (
        <InlineAlert variant="error" onDismiss={() => setReplicateError(null)}>
          {replicateError}
        </InlineAlert>
      )}

      {queuedMessage && !TERMINAL_STATUSES.includes(replicateStatus ?? '') && (
        <InlineAlert variant="info" title="Replication started">
          {queuedMessage}
        </InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <GlassCard
          title="Configure replication"
          description="Replicate runs SFDMU export + upsert from source to target. Replicate is the deploy — no second step."
        >
          <FormSection title="Source and target">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Source Org</Label>
                <Select
                  value={form.sourceOrgId}
                  onChange={(e) => setForm({ ...form, sourceOrgId: e.target.value })}
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
            </div>
            <div className="mt-4">
              <Label>Maximum records to replicate</Label>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={ORG_TO_ORG_RECORD_LIMIT_MAX}
                  value={form.recordLimit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recordLimit: Math.min(
                        ORG_TO_ORG_RECORD_LIMIT_MAX,
                        Math.max(1, Number(e.target.value) || 200),
                      ),
                    })
                  }
                  className="w-28"
                />
                <span className="text-xs text-muted-foreground">
                  replaces any LIMIT in SOQL (max {ORG_TO_ORG_RECORD_LIMIT_MAX.toLocaleString()})
                </span>
              </div>
              {willChunk && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Will run as {chunkCount} SFDMU chunks of up to{' '}
                  {DATA_DEPLOY_CHUNK_SIZE.toLocaleString()} records each.
                </p>
              )}
            </div>
            <div className="mt-4">
              <Label>SOQL Query</Label>
              <Textarea
                value={form.soql}
                onChange={(e) => setForm({ ...form, soql: e.target.value })}
                className="font-mono text-xs min-h-[120px] studio-console"
              />
            </div>
          </FormSection>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => void handlePreview()}
              loading={previewLoading}
              disabled={!form.sourceOrgId}
            >
              Preview
            </Button>
            <Button
              onClick={() => void handleReplicate()}
              loading={loading}
              disabled={
                !form.sourceOrgId
                || !form.targetOrgId
                || form.sourceOrgId === form.targetOrgId
                || isRunning
              }
            >
              Replicate
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
        </GlassCard>

        <GlassCard title="Recent replications" description="Past SFDMU replication runs.">
          <ListRowGroup emptyMessage="No replications yet." maxHeight="420px">
            {movements.map((m) => (
              <ListRow
                key={m.id}
                title={`${m.sourceOrg.alias} → ${m.targetOrg.alias}`}
                subtitle={relativeTime(m.createdAt)}
                status={m.status}
                trailing={<StatusBadge status={m.status} />}
              />
            ))}
          </ListRowGroup>
        </GlassCard>
      </div>

      {(jobId || replicateStatus) && (
        <GlassCard title="Replication progress" description="Live SFDMU output from the API host.">
          {batchId && <DataDeployBatchProgress batchId={batchId} onTerminal={loadMovements} />}
          {job?.error && (
            <InlineAlert variant="error" className="mb-3">
              {job.error}
            </InlineAlert>
          )}
          <div className="studio-console rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border/60 text-muted-foreground text-xs">
              SFDMU output
            </div>
            <div className="h-48 overflow-y-auto p-3 space-y-0.5 text-xs">
              {logs.length === 0 && (
                <p className="text-muted-foreground">Waiting for SFDMU output…</p>
              )}
              {logs.map((line, i) => (
                <div key={`${i}-${line.slice(0, 12)}`}>{line}</div>
              ))}
              <div ref={logBottomRef} />
            </div>
          </div>
          {replicateStatus && (
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge status={replicateStatus} />
              {replicateStatus === 'completed' && (
                <InlineAlert variant="success" className="flex-1 py-2">
                  Replication completed — records upserted to target org.
                </InlineAlert>
              )}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
