'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { FormSection, InlineAlert, StatusBadge } from '@/components/studio';
import { useOrgs } from '@/hooks/use-orgs';
import { api } from '@/services/api';

type Bottler = '5000' | '4900' | '4600';

interface MigrationStats {
  total: number;
  ready: number;
  duplicates: number;
  skippedWrongBottler: number;
  skippedMissingOffice: number;
  skippedMissingAccountKey: number;
  skippedMissingEmployeeKey: number;
  skippedMissingRole: number;
  skippedTargetAccount: number;
  skippedTargetEmployee: number;
}

interface MappingPreview {
  ok: boolean;
  query: string;
  stats: MigrationStats;
  targetAccounts: number;
  targetEmployees: number;
  sample: Array<Record<string, string>>;
}

interface JobData {
  id: string;
  status: string;
  error?: string | null;
  logs?: Array<{ line: string }>;
}

const TERMINAL_STATUSES = ['completed', 'partial', 'failed', 'cancelled'];
const ACCOUNT_FIELD = 'cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c';
const EMPLOYEE_FIELD = 'cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c';
const EXTERNAL_ID_FIELD = 'cfs_ob__AccountPartnerExternalId__c';

function defaultPartnerSoql(bottler: Bottler) {
  return `SELECT
  cfs_ob__AccountPartnerExternalId__c,
  cfs_ob__PartnerRole__c,
  cfs_ob__PartnerFunction__c,
  cfs_ob__Bottler__c,
  cfs_ob__Sales_Office__c,
  cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c,
  cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c
FROM cfs_ob__AccountPartner__c
WHERE cfs_ob__Bottler__c = '${bottler}'`;
}

function skippedCount(stats: MigrationStats) {
  return stats.total - stats.ready;
}

export function AccountPartnersPanel() {
  const { orgs } = useOrgs();
  const [sourceOrgId, setSourceOrgId] = useState('');
  const [targetOrgId, setTargetOrgId] = useState('');
  const [bottler, setBottler] = useState<Bottler>('5000');
  const [recordLimit, setRecordLimit] = useState(10_000);
  const [partnerSoql, setPartnerSoql] = useState(() => defaultPartnerSoql('5000'));
  const [preview, setPreview] = useState<MappingPreview | null>(null);
  const [action, setAction] = useState<'preview' | 'migrate' | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logBottomRef = useRef<HTMLDivElement>(null);

  const payload = useMemo(() => ({
    sourceOrgId,
    targetOrgId,
    bottler,
    partnerSoql,
    recordLimit,
  }), [bottler, partnerSoql, recordLimit, sourceOrgId, targetOrgId]);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!jobId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const current = await api<JobData>(`/jobs/${jobId}`);
        if (disposed) return;
        setJob(current);
        setLogs(current.logs?.map((entry) => entry.line) ?? []);
        if (!TERMINAL_STATUSES.includes(current.status)) {
          timer = setTimeout(poll, 2_000);
        }
      } catch {
        if (!disposed) timer = setTimeout(poll, 3_000);
      }
    };
    void poll();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const validate = () => {
    if (!sourceOrgId || !targetOrgId) throw new Error('Select source and target orgs');
    if (sourceOrgId === targetOrgId) throw new Error('Source and target org must differ');
    if (!partnerSoql.trim()) throw new Error('Enter an Account Partner SOQL query');
  };

  const handlePreview = async () => {
    setError(null);
    setAction('preview');
    try {
      validate();
      const result = await api<MappingPreview>('/data/account-partners/mapping/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPreview(result);
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : 'Account Partner preview failed');
    } finally {
      setAction(null);
    }
  };

  const handleMigrate = async () => {
    setError(null);
    setAction('migrate');
    setJobId(null);
    setJob(null);
    setLogs([]);
    try {
      validate();
      const result = await api<{ jobId: string }>('/data/account-partners/mapping/run', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setJobId(result.jobId);
      setJob({ id: result.jobId, status: 'queued' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account Partner migration failed');
    } finally {
      setAction(null);
    }
  };

  const jobActive = job?.status === 'queued' || job?.status === 'running';
  const disabled =
    !sourceOrgId
    || !targetOrgId
    || sourceOrgId === targetOrgId
    || !partnerSoql.trim()
    || action !== null
    || jobActive;

  return (
    <div className="space-y-6">
      <InlineAlert variant="info" title="Query-driven Account Partner migration">
        This migration creates or updates Account Partner records only. Referenced Accounts and
        Employee Masters must already exist in the target org. Preview shows every mapping that
        will be skipped before you migrate.
      </InlineAlert>

      <FormSection title="Orgs">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="partner-source-org">Source Org</Label>
            <Select
              id="partner-source-org"
              value={sourceOrgId}
              onChange={(event) => {
                setSourceOrgId(event.target.value);
                setPreview(null);
              }}
            >
              <option value="">Select…</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>{org.alias}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="partner-target-org">Target Org</Label>
            <Select
              id="partner-target-org"
              value={targetOrgId}
              onChange={(event) => {
                setTargetOrgId(event.target.value);
                setPreview(null);
              }}
            >
              <option value="">Select…</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>{org.alias}</option>
              ))}
            </Select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Migration scope">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="partner-bottler">Bottler</Label>
            <Select
              id="partner-bottler"
              value={bottler}
              onChange={(event) => {
                const next = event.target.value as Bottler;
                setPartnerSoql((current) =>
                  current === defaultPartnerSoql(bottler)
                    ? defaultPartnerSoql(next)
                    : current);
                setBottler(next);
                setPreview(null);
              }}
            >
              <option value="5000">5000 — Northeast</option>
              <option value="4900">4900 — Abarta</option>
              <option value="4600">4600 — Reyes</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="partner-record-limit">Maximum source records</Label>
            <Input
              id="partner-record-limit"
              type="number"
              min={1}
              max={100_000}
              value={recordLimit}
              onChange={(event) => {
                setRecordLimit(
                  Math.min(100_000, Math.max(1, Number(event.target.value) || 1)),
                );
                setPreview(null);
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Upper bound; the query can match fewer records.
            </p>
          </div>
        </div>
      </FormSection>

      <FormSection title="Account Partner query">
        <p className="mb-2 text-xs text-muted-foreground">
          Keep the Account customer number, Employee number, bottler, sales office, and partner
          role/function fields in the SELECT list. Add any WHERE conditions needed for this run.
        </p>
        <Textarea
          id="partner-soql"
          aria-label="Account Partner SOQL"
          value={partnerSoql}
          className="min-h-64 font-mono text-xs"
          onChange={(event) => {
            setPartnerSoql(event.target.value);
            setPreview(null);
          }}
        />
      </FormSection>

      {error && (
        <InlineAlert variant="error" onDismiss={() => setError(null)}>
          {error}
        </InlineAlert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={disabled}
          loading={action === 'preview'}
          onClick={() => void handlePreview()}
        >
          Preview mappings
        </Button>
        <Button
          disabled={disabled}
          loading={action === 'migrate'}
          onClick={() => void handleMigrate()}
        >
          Migrate Account Partners
        </Button>
      </div>

      {preview && (
        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <InlineAlert
            variant={preview.ok ? 'success' : 'warning'}
            title={preview.ok ? 'Mappings ready' : 'No mappings ready'}
          >
            {preview.stats.ready.toLocaleString()} of{' '}
            {preview.stats.total.toLocaleString()} queried records can be migrated.
          </InlineAlert>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Ready', preview.stats.ready],
              ['Skipped', skippedCount(preview.stats)],
              ['Target Accounts', preview.targetAccounts],
              ['Target Employees', preview.targetEmployees],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">{Number(value).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
            <p>Missing target Accounts: {preview.stats.skippedTargetAccount.toLocaleString()}</p>
            <p>
              Missing target Employee Masters:{' '}
              {preview.stats.skippedTargetEmployee.toLocaleString()}
            </p>
            <p>Duplicate mappings: {preview.stats.duplicates.toLocaleString()}</p>
            <p>Wrong bottler: {preview.stats.skippedWrongBottler.toLocaleString()}</p>
            <p>
              Missing source keys:{' '}
              {(
                preview.stats.skippedMissingAccountKey
                + preview.stats.skippedMissingEmployeeKey
              ).toLocaleString()}
            </p>
            <p>
              Missing office/role:{' '}
              {(
                preview.stats.skippedMissingOffice
                + preview.stats.skippedMissingRole
              ).toLocaleString()}
            </p>
          </div>
          {preview.sample.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">External ID</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, index) => (
                    <tr
                      key={`${row[EXTERNAL_ID_FIELD] ?? 'mapping'}-${index}`}
                      className="border-t border-border/60"
                    >
                      <td className="px-3 py-2 font-mono">{row[EXTERNAL_ID_FIELD]}</td>
                      <td className="px-3 py-2 font-mono">{row[ACCOUNT_FIELD]}</td>
                      <td className="px-3 py-2 font-mono">{row[EMPLOYEE_FIELD]}</td>
                      <td className="px-3 py-2">{row.cfs_ob__PartnerRole__c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Normalized migration query</summary>
            <pre className="studio-console mt-2 overflow-x-auto whitespace-pre-wrap rounded p-3">
              {preview.query}
            </pre>
          </details>
        </div>
      )}

      {jobId && (
        <div className="space-y-3 rounded-lg border border-border/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Account Partner migration</p>
            {job?.status && <StatusBadge status={job.status} />}
          </div>
          {job?.error && <InlineAlert variant="error">{job.error}</InlineAlert>}
          {job?.status === 'completed' && (
            <InlineAlert variant="success">
              Account Partner migration completed successfully.
            </InlineAlert>
          )}
          <div className="studio-console h-52 overflow-y-auto rounded-lg p-3 text-xs">
            {logs.length === 0 && (
              <p className="text-muted-foreground">
                {jobActive ? 'Preparing migration output…' : 'No job output was captured.'}
              </p>
            )}
            {logs.map((line, index) => <div key={index}>{line}</div>)}
            <div ref={logBottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}
