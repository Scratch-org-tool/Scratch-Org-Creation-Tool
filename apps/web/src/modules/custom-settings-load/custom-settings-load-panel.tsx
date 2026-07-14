'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label, Select, Textarea } from '@/components/ui/input';
import {
  FormSection,
  GlassCard,
  InlineAlert,
  ListRow,
  ListRowGroup,
  OptionTile,
  StatusBadge,
  relativeTime,
} from '@/components/studio';
import { api, getStreamUrl } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';
import {
  OrgConfigLoadAction,
  type OrgConfigLoadResult,
} from '@/modules/org-setup/org-config-load-action';
import { CustomSettingsPageHeader } from './custom-settings-page-header';

interface Org {
  id: string;
  alias: string;
}

interface JobData {
  id: string;
  status: string;
  error?: string | null;
  logs?: Array<{ line: string }>;
}

interface DataMovement {
  id: string;
  status: string;
  createdAt: string;
  sourceOrg: { alias: string };
  targetOrg: { id: string; alias: string };
}

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

export function CustomSettingsLoadPanel() {
  const { orgs } = useOrgs();
  const [mode, setMode] = useState<'bundled' | 'custom'>('bundled');
  const [customJson, setCustomJson] = useState('');
  const [sourceOrgId, setSourceOrgId] = useState('');
  const [targetOrgId, setTargetOrgId] = useState('');
  const [validation, setValidation] = useState<{ objectCount: number; warnings: string[] } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sfdmuInstalled, setSfdmuInstalled] = useState<boolean | null>(null);
  const [movements, setMovements] = useState<DataMovement[]>([]);
  const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);
  const [orgConfigCompletedByMovement, setOrgConfigCompletedByMovement] = useState<
    Record<string, boolean>
  >({});
  const [postLoadOrgConfigDone, setPostLoadOrgConfigDone] = useState(false);
  const [autoOrgConfigStatus, setAutoOrgConfigStatus] = useState<
    'idle' | 'loading' | 'done' | 'error'
  >('idle');
  const [autoOrgConfigWarnings, setAutoOrgConfigWarnings] = useState<string[]>([]);
  const autoOrgConfigRef = useRef(false);
  const logBottomRef = useRef<HTMLDivElement>(null);

  const loadMovements = useCallback(async () => {
    try {
      const data = await api<DataMovement[]>('/data/movements?movementType=custom_settings');
      setMovements(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    api<unknown>('/data/custom-settings/template').then((t) => {
      setCustomJson(JSON.stringify(t, null, 2));
    });
    api<{ sfdmuInstalled: boolean }>('/data/custom-settings/preflight')
      .then((r) => setSfdmuInstalled(r.sfdmuInstalled))
      .catch(() => setSfdmuInstalled(null));
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
            setJob((j) => (j ? { ...j, status: data.payload.status! } : { id: jobId, status: data.payload.status! }));
          }
        } catch {
          /* ignore */
        }
      };
    })();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [jobId]);

  useEffect(() => {
    if (job?.status !== 'completed' || !targetOrgId || autoOrgConfigRef.current) return;
    autoOrgConfigRef.current = true;
    setAutoOrgConfigStatus('loading');
    void api<OrgConfigLoadResult>(`/environment/orgs/${targetOrgId}/load-config`, {
        method: 'POST',
        body: JSON.stringify({
          orgConfig: {
            upsertQueueIds: true,
            upsertDomainFields: true,
            upsertRequestId: true,
          },
        }),
      })
      .then((res: OrgConfigLoadResult) => {
        const logs = Array.isArray(res.logs) ? res.logs : [];
        setAutoOrgConfigWarnings(logs.filter((line: string) => line.includes('WARN:')));
        setAutoOrgConfigStatus('done');
        setPostLoadOrgConfigDone(true);
      })
      .catch(() => {
        setAutoOrgConfigStatus('error');
        autoOrgConfigRef.current = false;
      });
  }, [job?.status, targetOrgId]);

  const validate = async () => {
    const body = mode === 'bundled' ? await api('/data/custom-settings/template') : JSON.parse(customJson);
    const res = await api<{ objectCount: number; warnings: string[] }>('/data/custom-settings/validate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setValidation(res);
  };

  const run = async () => {
    setLoading(true);
    setLogs([]);
    setJob(null);
    setJobId(null);
    autoOrgConfigRef.current = false;
    setAutoOrgConfigStatus('idle');
    setAutoOrgConfigWarnings([]);
    setPostLoadOrgConfigDone(false);
    try {
      const res = await api<{ jobId: string }>('/data/custom-settings/run', {
        method: 'POST',
        body: JSON.stringify({
          sourceOrgId,
          targetOrgId,
          mode,
          ...(mode === 'custom' ? { exportConfig: JSON.parse(customJson) } : {}),
        }),
      });
      setJobId(res.jobId);
      setJob({ id: res.jobId, status: 'queued' });
    } catch (err) {
      setJob({ id: '', status: 'failed', error: err instanceof Error ? err.message : 'Run failed' });
    } finally {
      setLoading(false);
    }
  };

  const targetAlias = orgs.find((o) => o.id === targetOrgId)?.alias;
  const isRunning = job?.status === 'running' || job?.status === 'queued' || loading;

  return (
    <div className="p-4 md:p-6 w-full space-y-5">
      <CustomSettingsPageHeader sfdmuInstalled={sfdmuInstalled} />

      {sfdmuInstalled === false && (
        <InlineAlert variant="warning" title="SFDMU plugin not installed">
          <p>
            Custom settings load requires the SFDMU Salesforce CLI plugin on the machine running the API.
            On that host, run <code className="text-xs">sf plugins install sfdmu</code> and verify with{' '}
            <code className="text-xs">sf sfdmu --version</code>.
          </p>
        </InlineAlert>
      )}

      <InlineAlert variant="info" title="Two-step load: custom settings + org config">
        <p className="mb-2">
          <strong>SFDMU custom settings</strong> copies portable data (thresholds, toggles, component
          configs) from source → target. It does <em>not</em> copy queue record IDs or domain URLs —
          those are org-specific.
        </p>
        <p>
          After SFDMU completes, <strong>Load Org Config</strong> runs automatically (or manually below)
          to map queue IDs, Lightning/domain URLs, and request ID prefix on{' '}
          <span className="font-mono">cfs_ob__OnboardingConfig__c</span> in the target org.
        </p>
      </InlineAlert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <GlassCard
          title="Configure load"
          description="Choose export source, validate configuration, and select orgs."
          className="h-full"
        >
          <FormSection title="Export configuration">
            <div className="space-y-2">
              <OptionTile
                label="Bundled CONA export"
                description="Use the built-in CONA custom settings export JSON."
                checked={mode === 'bundled'}
                onChange={(v) => v && setMode('bundled')}
              />
              <OptionTile
                label="Custom JSON"
                description="Paste or edit your own SFDMU export configuration."
                checked={mode === 'custom'}
                onChange={(v) => v && setMode('custom')}
              />
            </div>
            {mode === 'custom' && (
              <Textarea
                className="font-mono text-xs min-h-[200px] mt-3"
                value={customJson}
                onChange={(e) => setCustomJson(e.target.value)}
              />
            )}
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void validate()}>
              Validate
            </Button>
            {validation && (
              <p className="text-xs text-muted-foreground mt-2">
                {validation.objectCount} objects
                {validation.warnings.length > 0 && ` — ${validation.warnings.length} warnings`}
              </p>
            )}
          </FormSection>

          <FormSection title="Orgs" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Source org</Label>
                <Select value={sourceOrgId} onChange={(e) => setSourceOrgId(e.target.value)}>
                  <option value="">Select…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.alias}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Target org</Label>
                <Select value={targetOrgId} onChange={(e) => setTargetOrgId(e.target.value)}>
                  <option value="">Select…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.alias}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={() => void run()}
              loading={loading}
              disabled={!sourceOrgId || !targetOrgId || isRunning}
            >
              Run custom settings load
            </Button>
          </FormSection>
        </GlassCard>

        <GlassCard
          title="Recent custom settings loads"
          description="Past SFDMU runs and post-load actions."
          className="h-full"
        >
          <ListRowGroup emptyMessage="No custom settings loads yet." maxHeight="520px">
            {movements.map((m) => (
              <div key={m.id}>
                <ListRow
                  className="w-full"
                  title={`${m.sourceOrg.alias} → ${m.targetOrg.alias}`}
                  subtitle={relativeTime(m.createdAt)}
                  status={m.status}
                  trailing={
                    <div className="flex items-center gap-2 shrink-0">
                      {orgConfigCompletedByMovement[m.id] && (
                        <StatusBadge status="completed" label="Org config" />
                      )}
                      {m.status === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpandedMovementId((id) => (id === m.id ? null : m.id))
                          }
                        >
                          {expandedMovementId === m.id ? 'Hide' : 'Load Org Config'}
                        </Button>
                      )}
                      <StatusBadge status={m.status} />
                    </div>
                  }
                />
                {expandedMovementId === m.id && m.status === 'completed' && (
                  <OrgConfigLoadAction
                    orgId={m.targetOrg.id}
                    orgAlias={m.targetOrg.alias}
                    className="ml-7 mt-2 mb-2 pl-3 border-l border-border/60"
                    onComplete={() =>
                      setOrgConfigCompletedByMovement((prev) => ({ ...prev, [m.id]: true }))
                    }
                  />
                )}
              </div>
            ))}
          </ListRowGroup>
        </GlassCard>
      </div>

      {jobId && (
        <GlassCard title="SFDMU job progress" description="Live output from the SFDMU run on the API host.">
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
          {job?.status && (
            <div className="mt-3">
              <StatusBadge status={job.status} />
            </div>
          )}
        </GlassCard>
      )}

      {job?.status === 'completed' && targetOrgId && (
        <GlassCard
          title="Post-load actions"
          description="Org config maps queue IDs and domain fields on the target org. Runs automatically after SFDMU; use Run again to retry."
          headerAction={
            postLoadOrgConfigDone ? (
              <StatusBadge
                status={autoOrgConfigWarnings.length > 0 ? 'running' : 'completed'}
                label={
                  autoOrgConfigWarnings.length > 0 ? 'Org config (warnings)' : 'Org config'
                }
              />
            ) : autoOrgConfigStatus === 'loading' ? (
              <StatusBadge status="running" label="Org config…" />
            ) : undefined
          }
        >
          {autoOrgConfigStatus === 'loading' && (
            <InlineAlert variant="info" className="mb-3">
              Running Load Org Config on the target org…
            </InlineAlert>
          )}
          {autoOrgConfigStatus === 'error' && (
            <InlineAlert variant="error" className="mb-3">
              Auto Load Org Config failed. Run manually below.
            </InlineAlert>
          )}
          {autoOrgConfigWarnings.length > 0 && (
            <InlineAlert variant="warning" title="Queue mapping warnings" className="mb-3">
              <ul className="list-disc pl-4 space-y-0.5 text-xs">
                {autoOrgConfigWarnings.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </InlineAlert>
          )}
          <OrgConfigLoadAction
            orgId={targetOrgId}
            orgAlias={targetAlias}
            onComplete={() => setPostLoadOrgConfigDone(true)}
          />
        </GlassCard>
      )}

      {job?.status === 'failed' && job.error && (
        <InlineAlert variant="error">{job.error}</InlineAlert>
      )}
    </div>
  );
}
