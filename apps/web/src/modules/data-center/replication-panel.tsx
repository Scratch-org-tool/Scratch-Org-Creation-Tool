'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import {
  FormSection,
  GlassCard,
  ConfirmDialog,
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
  extractObjectFromSoql,
} from '@sfcc/shared';
import { api } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';
import { DataPreviewTable } from './data-preview-table';
import { DataDeployBatchProgress } from './data-deploy-batch-progress';
import {
  buildReplicationPayload,
  DATA_CENTER_ADD_QUERY_EVENT,
  dependencyError,
  moveByIndex,
  preflightKey,
  type DataPreflightReport,
  type ReplicationQuery,
} from './data-center-contracts';
import { DataPreflightReportView } from './data-preflight-report';

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
    recordLimit: 200,
    maxParallelChunks: 4,
  });
  const [queries, setQueries] = useState<ReplicationQuery[]>([{
    id: 'query-1',
    label: 'Onboarding config',
    object: 'cfs_ob__Onboarding_Config__c',
    soql: 'SELECT Id, Name, cfs_ob__Status__c, RecordTypeId FROM cfs_ob__Onboarding_Config__c',
    operation: 'insert',
    dependsOn: [],
  }]);
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
  const [preflight, setPreflight] = useState<{
    querySet: { queries: ReplicationQuery[] };
    preflight: Array<{ queryId: string; objectName: string; report: DataPreflightReport }>;
    quotaSummary: { estimatedBulkBatches: number; remaining: number | null; sufficient: boolean };
  } | null>(null);
  const [preflightKeyValue, setPreflightKeyValue] = useState<string | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const logBottomRef = useRef<HTMLDivElement>(null);
  const replicationPayload = buildReplicationPayload({
    ...form,
    queries,
    defaultLimit: form.recordLimit,
    dryRun: false,
  });
  const currentKey = preflightKey(replicationPayload);
  const graphError = dependencyError(queries.map((query, order) => ({
    id: query.id,
    objectName: query.object,
    dependsOn: query.dependsOn,
    order,
  })));
  const hasCurrentPreflight = Boolean(preflight && preflightKeyValue === currentKey);

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
    const addTemplate = (event: Event) => {
      const detail = (event as CustomEvent<{ target: string; query: ReplicationQuery }>).detail;
      if (detail?.target !== 'replication' || !detail.query) return;
      setQueries((current) => {
        const existing = new Set(current.map((query) => query.id));
        let id = detail.query.id;
        let suffix = 2;
        while (existing.has(id)) id = `${detail.query.id}-${suffix++}`;
        return [...current, { ...detail.query, id }];
      });
    };
    window.addEventListener(DATA_CENTER_ADD_QUERY_EVENT, addTemplate);
    return () => window.removeEventListener(DATA_CENTER_ADD_QUERY_EVENT, addTemplate);
  }, []);

  useEffect(() => {
    if (preflightKeyValue && preflightKeyValue !== currentKey) {
      setPreflight(null);
      setPreflightKeyValue(null);
      setConfirming(false);
    }
  }, [currentKey, preflightKeyValue]);

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
          replaceOrApplyLimit(queries[0]?.soql ?? '', form.recordLimit),
        )}&recordLimit=${form.recordLimit}`,
      );
      setPreview(res);
    } catch (err) {
      setReplicateError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const runPreflight = async (openConfirmation: boolean) => {
    if (graphError) {
      setReplicateError(graphError);
      return;
    }
    setPreflightLoading(true);
    setReplicateError(null);
    try {
      const result = await api<{
        querySet: { queries: ReplicationQuery[] };
        preflight: Array<{ queryId: string; objectName: string; report: DataPreflightReport }>;
        quotaSummary: { estimatedBulkBatches: number; remaining: number | null; sufficient: boolean };
      }>('/data/replicate', {
        method: 'POST',
        body: JSON.stringify({ ...replicationPayload, dryRun: true }),
      });
      setPreflight(result);
      setPreflightKeyValue(currentKey);
      const safe = result.preflight.every((item) => item.report.ok) && result.quotaSummary.sufficient;
      if (openConfirmation && safe) setConfirming(true);
      if (openConfirmation && !safe) {
        setReplicateError('Preflight failed. Resolve every query and quota issue before replication.');
      }
    } catch (error) {
      setReplicateError(error instanceof Error ? error.message : 'Preflight failed');
      setPreflight(null);
      setPreflightKeyValue(null);
    } finally {
      setPreflightLoading(false);
    }
  };

  const handleReplicate = async () => {
    if (form.sourceOrgId === form.targetOrgId) {
      setReplicateError('Source and target org must differ.');
      return;
    }
    if (
      !hasCurrentPreflight
      || !preflight?.preflight.every((item) => item.report.ok)
      || !preflight.quotaSummary.sufficient
    ) {
      setReplicateError('Run a successful preflight for the current query set before replication.');
      return;
    }
    setConfirming(false);
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
          ...replicationPayload,
          dryRun: false,
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
                <Label htmlFor="replication-source-org">Source Org</Label>
                <Select
                  id="replication-source-org"
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
                <Label htmlFor="replication-target-org">Target Org</Label>
                <Select
                  id="replication-target-org"
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
              <Label htmlFor="replication-record-limit">Maximum records to replicate</Label>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Input
                  id="replication-record-limit"
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
            <div className="mt-4 flex items-center gap-2">
              <Label htmlFor="replication-parallel-chunks">Parallel chunks</Label>
              <Input
                id="replication-parallel-chunks"
                type="number"
                min={1}
                max={32}
                className="w-20"
                value={form.maxParallelChunks}
                onChange={(event) => setForm({
                  ...form,
                  maxParallelChunks: Math.min(32, Math.max(1, Number(event.target.value) || 1)),
                })}
              />
            </div>
          </FormSection>
          <FormSection title="Ordered query plan">
            <div className="space-y-3">
              {queries.map((query, index) => (
                <div key={query.id} className="space-y-3 rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Step {index + 1}: {query.label}</p>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={index === 0}
                        aria-label={`Move ${query.label} earlier`}
                        onClick={() => setQueries((current) => moveByIndex(current, index, -1))}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={index === queries.length - 1}
                        aria-label={`Move ${query.label} later`}
                        onClick={() => setQueries((current) => moveByIndex(current, index, 1))}
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={queries.length === 1}
                        onClick={() => setQueries((current) => current.filter((item) => item.id !== query.id))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`replication-label-${query.id}`}>Label</Label>
                      <Input
                        id={`replication-label-${query.id}`}
                        value={query.label}
                        onChange={(event) => setQueries((current) => current.map((item) =>
                          item.id === query.id ? { ...item, label: event.target.value } : item))}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`replication-object-${query.id}`}>Object</Label>
                      <Input
                        id={`replication-object-${query.id}`}
                        value={query.object}
                        onChange={(event) => setQueries((current) => current.map((item) =>
                          item.id === query.id ? { ...item, object: event.target.value } : item))}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`replication-operation-${query.id}`}>Operation</Label>
                      <Select
                        id={`replication-operation-${query.id}`}
                        value={query.operation}
                        onChange={(event) => setQueries((current) => current.map((item) =>
                          item.id === query.id
                            ? {
                                ...item,
                                operation: event.target.value as 'insert' | 'upsert',
                                externalIdField: event.target.value === 'upsert'
                                  ? item.externalIdField
                                  : undefined,
                              }
                            : item))}
                      >
                        <option value="insert">Insert</option>
                        <option value="upsert">Upsert</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`replication-external-${query.id}`}>External ID</Label>
                      <Input
                        id={`replication-external-${query.id}`}
                        disabled={query.operation !== 'upsert'}
                        value={query.externalIdField ?? ''}
                        onChange={(event) => setQueries((current) => current.map((item) =>
                          item.id === query.id ? { ...item, externalIdField: event.target.value } : item))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`replication-soql-${query.id}`}>SOQL</Label>
                    <Textarea
                      id={`replication-soql-${query.id}`}
                      value={query.soql}
                      onChange={(event) => {
                        const soql = event.target.value;
                        setQueries((current) => current.map((item) =>
                          item.id === query.id
                            ? { ...item, soql, object: extractObjectFromSoql(soql) ?? item.object }
                            : item));
                      }}
                      className="font-mono text-xs min-h-[100px] studio-console"
                    />
                  </div>
                  {index > 0 && (
                    <div>
                      <p className="text-xs font-medium">Dependencies</p>
                      <div className="mt-1 flex flex-wrap gap-3">
                        {queries.filter((candidate) => candidate.id !== query.id).map((candidate) => (
                          <label key={candidate.id} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={query.dependsOn.includes(candidate.id)}
                              onChange={(event) => setQueries((current) => current.map((item) => {
                                if (item.id !== query.id) return item;
                                const next = new Set(item.dependsOn);
                                if (event.target.checked) next.add(candidate.id);
                                else next.delete(candidate.id);
                                return { ...item, dependsOn: [...next] };
                              }))}
                            />
                            {candidate.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const number = queries.length + 1;
                  setQueries((current) => [...current, {
                    id: `query-${Date.now()}`,
                    label: `Query ${number}`,
                    object: 'Account',
                    soql: 'SELECT Id, Name FROM Account',
                    operation: 'insert',
                    dependsOn: [],
                  }]);
                }}
              >
                Add query
              </Button>
              {graphError && <InlineAlert variant="error">{graphError}</InlineAlert>}
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
              variant="outline"
              onClick={() => void runPreflight(false)}
              loading={preflightLoading}
              disabled={
                !form.sourceOrgId
                || !form.targetOrgId
                || form.sourceOrgId === form.targetOrgId
                || Boolean(graphError)
                || queries.some((query) => query.operation === 'upsert' && !query.externalIdField)
              }
            >
              Dry-run preflight
            </Button>
            <Button
              onClick={() => void runPreflight(true)}
              loading={preflightLoading || loading}
              disabled={
                !form.sourceOrgId
                || !form.targetOrgId
                || form.sourceOrgId === form.targetOrgId
                || isRunning
                || Boolean(graphError)
                || queries.some((query) => query.operation === 'upsert' && !query.externalIdField)
              }
            >
              Review &amp; replicate
            </Button>
          </div>
          {preflight && hasCurrentPreflight && (
            <div className="mt-4 space-y-3">
              <InlineAlert variant={preflight.quotaSummary.sufficient ? 'info' : 'error'}>
                Plan: {preflight.preflight.length} quer{preflight.preflight.length === 1 ? 'y' : 'ies'},{' '}
                {preflight.quotaSummary.estimatedBulkBatches} estimated Bulk batch(es),{' '}
                {preflight.quotaSummary.remaining ?? 'unknown'} remaining.
              </InlineAlert>
              {preflight.preflight.map((item, index) => (
                <DataPreflightReportView
                  key={item.queryId}
                  report={item.report}
                  title={`${index + 1}. ${item.objectName}`}
                />
              ))}
            </div>
          )}
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
                  Replication completed — the server confirmed every query step.
                </InlineAlert>
              )}
            </div>
          )}
        </GlassCard>
      )}
      <ConfirmDialog
        open={confirming}
        title="Start this replication plan?"
        message={`Run ${preflight?.preflight.length ?? queries.length} ordered query step(s) using ${preflight?.quotaSummary.estimatedBulkBatches ?? 'an unknown number of'} estimated Bulk batch(es). Insert steps are not safely retryable; upsert steps use their displayed external IDs.`}
        confirmLabel="Start replication"
        loading={loading}
        onOpenChange={setConfirming}
        onConfirm={() => void handleReplicate()}
      />
    </div>
  );
}
