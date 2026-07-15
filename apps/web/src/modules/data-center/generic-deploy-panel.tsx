'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import {
  FormSection,
  ConfirmDialog,
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
import type { OrgToOrgObjectMeta } from './types';
import {
  buildGenericDeployPayload,
  defaultOperationForMeta,
  externalIdOptions,
  DATA_CENTER_ADD_QUERY_EVENT,
  preflightKey,
  type DataPreflightReport,
  type DataOperation,
  type ReplicationQuery,
} from './data-center-contracts';
import { DataPreflightReportView } from './data-preflight-report';
import { DataMovementControls } from './data-movement-controls';

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
  canCancel?: boolean;
  canRollback?: boolean;
  batchId?: string | null;
  rollbackStatus?: string | null;
  rollbackReport?: unknown;
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
    operation: 'insert' as DataOperation,
    externalIdField: '',
    rollbackEnabled: false,
    maxParallelChunks: 4,
  });
  const [objectMeta, setObjectMeta] = useState<OrgToOrgObjectMeta | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [preflight, setPreflight] = useState<DataPreflightReport | null>(null);
  const [preflightConfigKey, setPreflightConfigKey] = useState<string | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
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
  const [confirmingDeploy, setConfirmingDeploy] = useState(false);
  const logBottomRef = useRef<HTMLDivElement>(null);
  const previewRequestRef = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);
  const movementListRequestRef = useRef(0);
  const jobPollGenerationRef = useRef(0);
  const movementPollGenerationRef = useRef(0);
  const preflightRequestRef = useRef(0);
  const deployRequestRef = useRef(0);

  const runtimePayload = buildGenericDeployPayload({
    ...form,
    dryRun: false,
  });
  const runtimeKey = preflightKey(runtimePayload);
  const runtimeKeyRef = useRef(runtimeKey);
  runtimeKeyRef.current = runtimeKey;
  const hasCurrentPreflight = Boolean(preflight && preflightConfigKey === runtimeKey);
  const externalIds = externalIdOptions(objectMeta);

  const loadMovements = useCallback(() => {
    const request = ++movementListRequestRef.current;
    api<Movement[]>('/data/movements')
      .then((list) => {
        if (request === movementListRequestRef.current) {
          setMovements(list.filter((m) => m.movementType === 'deploy'));
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    const addTemplate = (event: Event) => {
      const detail = (event as CustomEvent<{
        target: string;
        query: ReplicationQuery;
      }>).detail;
      if (detail?.target !== 'deploy' || !detail.query) return;
      setForm((current) => ({
        ...current,
        objectName: detail.query.object,
        soql: detail.query.soql,
        recordLimit: detail.query.limit ?? current.recordLimit,
        operation: detail.query.operation,
        externalIdField: detail.query.externalIdField ?? '',
      }));
    };
    window.addEventListener(DATA_CENTER_ADD_QUERY_EVENT, addTemplate);
    return () => window.removeEventListener(DATA_CENTER_ADD_QUERY_EVENT, addTemplate);
  }, []);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!jobId) return;
    const generation = ++jobPollGenerationRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    const poll = async () => {
      controller = new AbortController();
      try {
        const data = await api<JobData>(`/jobs/${jobId}`, { signal: controller.signal });
        if (generation !== jobPollGenerationRef.current) return;
        setJob(data);
        if (data.logs?.length) {
          setLogs(data.logs.map((l) => l.line));
        }
        if (TERMINAL_STATUSES.includes(data.status)) {
          loadMovements();
          return;
        }
      } catch {
        /* ignore */
      }
      if (generation === jobPollGenerationRef.current) {
        timer = setTimeout(() => void poll(), 2000);
      }
    };
    void poll();
    return () => {
      jobPollGenerationRef.current += 1;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [jobId, loadMovements]);

  useEffect(() => {
    if (!movementId) return;
    const generation = ++movementPollGenerationRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    const poll = async () => {
      controller = new AbortController();
      try {
        const data = await api<Movement>(`/data/movements/${movementId}`, {
          signal: controller.signal,
        });
        if (generation !== movementPollGenerationRef.current) return;
        setMovement(data);
        if (TERMINAL_STATUSES.includes(data.status)) return;
      } catch {
        /* ignore */
      }
      if (generation === movementPollGenerationRef.current) {
        timer = setTimeout(() => void poll(), 2000);
      }
    };
    void poll();
    return () => {
      movementPollGenerationRef.current += 1;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [movementId]);

  const previewSoql = replaceOrApplyLimit(
    form.soql?.trim() || `SELECT Id, Name FROM ${form.objectName}`,
    form.recordLimit,
  );

  const handlePreview = async () => {
    if (!form.sourceOrgId) return;
    const request = ++previewRequestRef.current;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
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
        { signal: controller.signal },
      );
      if (previewRequestRef.current === request && !controller.signal.aborted) setPreview(res);
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
    previewAbortRef.current?.abort();
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, [form.sourceOrgId, form.objectName, form.soql, form.recordLimit]);

  useEffect(() => {
    let cancelled = false;
    setObjectMeta(null);
    if (!form.sourceOrgId || !form.objectName.trim()) return;
    const timer = setTimeout(async () => {
      setMetadataLoading(true);
      try {
        const meta = await api<OrgToOrgObjectMeta>(
          `/data/org-to-org/object-meta?orgId=${encodeURIComponent(form.sourceOrgId)}&objectName=${encodeURIComponent(form.objectName.trim())}`,
        );
        if (cancelled) return;
        setObjectMeta(meta);
        const defaults = defaultOperationForMeta(meta);
        setForm((current) => ({
          ...current,
          operation: defaults.operation,
          externalIdField: defaults.externalIdField ?? '',
          rollbackEnabled: defaults.operation === 'upsert' && current.rollbackEnabled,
        }));
      } catch {
        if (!cancelled) setObjectMeta(null);
      } finally {
        if (!cancelled) setMetadataLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.sourceOrgId, form.objectName]);

  useEffect(() => {
    if (preflightConfigKey && preflightConfigKey !== runtimeKey) {
      preflightRequestRef.current += 1;
      setPreflight(null);
      setPreflightConfigKey(null);
      setPreflightLoading(false);
      setConfirmingDeploy(false);
    }
  }, [preflightConfigKey, runtimeKey]);

  const runPreflight = async (openConfirmation: boolean) => {
    if (preflightLoading || loading) return;
    const request = ++preflightRequestRef.current;
    const requestedKey = runtimeKey;
    setPreflightLoading(true);
    setDeployError(null);
    try {
      const report = await api<DataPreflightReport>('/data/deploy/preflight', {
        method: 'POST',
        body: JSON.stringify({ ...runtimePayload, dryRun: true }),
      });
      if (request !== preflightRequestRef.current || requestedKey !== runtimeKeyRef.current) return;
      setPreflight(report);
      setPreflightConfigKey(runtimeKey);
      if (openConfirmation && report.ok) setConfirmingDeploy(true);
      if (openConfirmation && !report.ok) {
        setDeployError('Preflight failed. Resolve every blocking issue before deployment.');
      }
    } catch (err) {
      if (request === preflightRequestRef.current) {
        setPreflight(null);
        setPreflightConfigKey(null);
        setDeployError(err instanceof Error ? err.message : 'Preflight failed');
      }
    } finally {
      if (request === preflightRequestRef.current) setPreflightLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (loading) return;
    const request = ++deployRequestRef.current;
    if (form.sourceOrgId === form.targetOrgId) {
      setDeployError('Source and target org must differ.');
      return;
    }
    setConfirmingDeploy(false);
    setLoading(true);
    setLogs([]);
    setJob(null);
    setMovement(null);
    setBatchId(null);
    setDeployError(null);
    try {
      if (!hasCurrentPreflight || !preflight?.ok) {
        setDeployError('Run a successful preflight for the current configuration before deploying.');
        return;
      }
      const res = await api<{
        movementId: string;
        jobId: string;
        status: string;
        batchId?: string;
        totalChunks?: number;
      }>('/data/deploy', {
        method: 'POST',
        body: JSON.stringify(runtimePayload),
      });
      if (request !== deployRequestRef.current) return;
      setJobId(res.jobId);
      setMovementId(res.movementId);
      setBatchId(res.batchId ?? null);
      setJob({ id: res.jobId, status: res.status });
    } catch (err) {
      if (request === deployRequestRef.current) {
        setDeployError(err instanceof Error ? err.message : 'Deploy failed');
      }
    } finally {
      if (request === deployRequestRef.current) setLoading(false);
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
              <Label htmlFor="generic-deploy-source-org">Source Org</Label>
              <Select id="generic-deploy-source-org" value={form.sourceOrgId} onChange={(e) => setForm({ ...form, sourceOrgId: e.target.value })}>
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.alias}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="generic-deploy-target-org">Target Org</Label>
              <Select id="generic-deploy-target-org" value={form.targetOrgId} onChange={(e) => setForm({ ...form, targetOrgId: e.target.value })}>
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
            <Label htmlFor="generic-deploy-object">Object</Label>
            <Input id="generic-deploy-object" value={form.objectName} onChange={(e) => setForm({ ...form, objectName: e.target.value })} />
            <p className="mt-1 text-xs text-muted-foreground">
              {metadataLoading
                ? 'Reading object metadata…'
                : objectMeta
                  ? `Metadata loaded for ${objectMeta.label}.`
                  : 'Object metadata is required to discover safe upsert keys.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="generic-deploy-operation">Write operation</Label>
              <Select
                id="generic-deploy-operation"
                value={form.operation}
                onChange={(e) => setForm({
                  ...form,
                  operation: e.target.value as DataOperation,
                  externalIdField: e.target.value === 'upsert'
                    ? form.externalIdField || externalIds[0] || ''
                    : '',
                  rollbackEnabled: e.target.value === 'upsert' && form.rollbackEnabled,
                })}
              >
                <option value="insert">Insert (non-idempotent)</option>
                <option value="upsert" disabled={externalIds.length === 0}>Upsert (safe retry)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="generic-deploy-external-id">External ID</Label>
              <Select
                id="generic-deploy-external-id"
                value={form.externalIdField}
                disabled={form.operation !== 'upsert'}
                onChange={(e) => setForm({ ...form, externalIdField: e.target.value })}
              >
                <option value="">Select external ID…</option>
                {externalIds.map((field) => <option key={field} value={field}>{field}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.rollbackEnabled}
                disabled={form.operation !== 'upsert'}
                onChange={(event) => setForm({ ...form, rollbackEnabled: event.target.checked })}
              />
              Capture rollback data
            </label>
            <div className="flex items-center gap-2">
              <Label htmlFor="generic-deploy-parallel">Parallel chunks</Label>
              <Input
                id="generic-deploy-parallel"
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
          </div>
          <div>
            <Label htmlFor="generic-deploy-record-limit">Maximum records to deploy</Label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Input
                id="generic-deploy-record-limit"
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
            <Label htmlFor="generic-deploy-soql">SOQL (optional)</Label>
            <Textarea
              id="generic-deploy-soql"
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
              variant="outline"
              onClick={() => void runPreflight(false)}
              loading={preflightLoading}
              disabled={
                !form.sourceOrgId
                || !form.targetOrgId
                || form.sourceOrgId === form.targetOrgId
                || (form.operation === 'upsert' && !form.externalIdField)
              }
            >
              Dry-run preflight
            </Button>
            <Button
              onClick={() => void runPreflight(true)}
              loading={preflightLoading || loading}
              disabled={
                isRunning
                || !form.sourceOrgId
                || !form.targetOrgId
                || form.sourceOrgId === form.targetOrgId
                || (form.operation === 'upsert' && !form.externalIdField)
              }
            >
              Review &amp; deploy
            </Button>
          </div>
          {preflight && hasCurrentPreflight && (
            <div className="mt-4">
              <DataPreflightReportView report={preflight} />
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
          <DataMovementControls
            movement={movement}
            onUpdated={(next) => setMovement((current) => current ? { ...current, ...next } : current)}
          />
        </div>
      </div>

      <FormSection title="Recent deployments">
        <ListRowGroup emptyMessage="No deployments yet.">
          {movements.map((m) => (
            <div key={m.id} className="border-b border-border/40 p-2 last:border-0">
              <ListRow
                title={m.objectName ?? 'Data deploy'}
                subtitle={`${m.sourceOrg.alias} → ${m.targetOrg.alias}`}
                status={m.status}
                trailing={
                  <span className="text-xs text-muted-foreground shrink-0">
                    {m.recordCount ?? '—'} · {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                }
              />
              <DataMovementControls
                movement={m}
                onUpdated={(next) => setMovements((current) => current.map((item) =>
                  item.id === next.id ? { ...item, ...next } : item))}
              />
            </div>
          ))}
        </ListRowGroup>
      </FormSection>
      <ConfirmDialog
        open={confirmingDeploy}
        title="Deploy data to the target org?"
        message={`${preflight?.operation ?? form.operation} up to ${preflight?.sourceCount?.toLocaleString() ?? form.recordLimit.toLocaleString()} ${form.objectName} records in ${preflight?.estimatedBulkBatches ?? 'an unknown number of'} batch(es). ${preflight?.idempotent ? 'This operation is idempotent.' : 'Insert is non-idempotent and failed chunks cannot be retried safely.'}`}
        confirmLabel="Deploy data"
        loading={loading}
        onConfirm={() => void handleDeploy()}
        onOpenChange={setConfirmingDeploy}
      />
    </div>
  );
}
