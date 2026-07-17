'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Circle,
  Database,
  Link2,
  Loader2,
  Search,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import {
  FormSection,
  InlineAlert,
  LoadingOverlay,
  StatCard,
  StatCardGrid,
  StatusBadge,
} from '@/components/studio';
import { useOrgs } from '@/hooks/use-orgs';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

type Bottler = '5000' | '4900' | '4600';

interface MigrationStats {
  total: number;
  ready: number;
  toCreate: number;
  toUpdate: number;
  duplicates: number;
  externalIdCollisions: number;
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
  nameField: {
    fieldName: string;
    mode: 'employee-master-name' | 'salesforce-managed';
  };
  sample: Array<{
    externalId: string;
    accountKey: string;
    accountName: string;
    employeeKey: string;
    employeeName: string;
    partnerName: string;
    action: 'create' | 'update';
    role: string;
    targetAccountId: string;
    targetEmployeeId: string;
  }>;
}

interface JobData {
  id: string;
  status: string;
  error?: string | null;
  logs?: Array<{ line: string }>;
}

const TERMINAL_STATUSES = ['completed', 'partial', 'failed', 'cancelled'];
const MIGRATION_STEPS = [
  {
    label: 'Queued',
    description: 'Migration job accepted',
    icon: Database,
  },
  {
    label: 'Match records',
    description: 'Resolve target Accounts and Employee Masters',
    icon: Search,
  },
  {
    label: 'Prepare changes',
    description: 'Separate records to create and update',
    icon: Link2,
  },
  {
    label: 'Apply changes',
    description: 'Upsert Account Partners in Salesforce',
    icon: UploadCloud,
  },
] as const;

function migrationStage(job: JobData | null, logs: string[]) {
  if (job?.status === 'completed') return MIGRATION_STEPS.length;
  if (logs.some((line) => line.includes('Upserting '))) return 3;
  if (logs.some((line) => line.includes('will be created'))) return 2;
  if (logs.some((line) => line.includes('Validating '))) return 1;
  return 0;
}

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
  const [submittedPlan, setSubmittedPlan] = useState<MappingPreview | null>(null);
  const [action, setAction] = useState<'preview' | 'migrate' | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logBottomRef = useRef<HTMLDivElement>(null);
  const previewGenerationRef = useRef(0);

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
    let failures = 0;
    const poll = async () => {
      try {
        const current = await api<JobData>(`/jobs/${jobId}`);
        if (disposed) return;
        failures = 0;
        setError(null);
        setJob(current);
        setLogs(current.logs?.map((entry) => entry.line) ?? []);
        if (!TERMINAL_STATUSES.includes(current.status)) {
          timer = setTimeout(poll, 2_000);
        }
      } catch {
        if (disposed) return;
        failures += 1;
        if (failures >= 5) {
          const message =
            'Job status could not be refreshed after multiple attempts. '
            + 'Check Monitoring before starting another migration.';
          setError(message);
          timer = setTimeout(poll, 10_000);
        } else {
          timer = setTimeout(poll, 3_000);
        }
      }
    };
    void poll();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const invalidatePreview = () => {
    previewGenerationRef.current += 1;
    setPreview(null);
  };

  const validate = () => {
    if (!sourceOrgId || !targetOrgId) throw new Error('Select source and target orgs');
    if (sourceOrgId === targetOrgId) throw new Error('Source and target org must differ');
    if (!partnerSoql.trim()) throw new Error('Enter an Account Partner SOQL query');
  };

  const handlePreview = async () => {
    const generation = previewGenerationRef.current + 1;
    previewGenerationRef.current = generation;
    setError(null);
    setAction('preview');
    try {
      validate();
      const result = await api<MappingPreview>('/data/account-partners/mapping/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (generation === previewGenerationRef.current) setPreview(result);
    } catch (cause) {
      if (generation === previewGenerationRef.current) {
        setPreview(null);
        setError(cause instanceof Error ? cause.message : 'Account Partner preview failed');
      }
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
    setSubmittedPlan(null);
    try {
      validate();
      const migrationPlan = preview;
      if (!migrationPlan?.ok) {
        throw new Error('Build a valid migration plan before starting the migration');
      }
      const result = await api<{ jobId: string }>('/data/account-partners/mapping/run', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setJobId(result.jobId);
      setJob({ id: result.jobId, status: 'queued' });
      setSubmittedPlan(migrationPlan);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account Partner migration failed');
    } finally {
      setAction(null);
    }
  };

  const jobActive = ['pending', 'queued', 'running'].includes(job?.status ?? '');
  const configurationLocked = action !== null || jobActive;
  const actionDisabled =
    !sourceOrgId
    || !targetOrgId
    || sourceOrgId === targetOrgId
    || !partnerSoql.trim()
    || action !== null
    || jobActive;
  const currentJobStage = migrationStage(job, logs);
  const jobFailed = ['failed', 'partial', 'cancelled'].includes(job?.status ?? '');

  return (
    <div className="relative space-y-6">
      {action && (
        <LoadingOverlay
          label={action === 'preview' ? 'Building migration plan…' : 'Starting migration…'}
          sublabel={
            action === 'preview'
              ? 'Matching source records to target Accounts and Employee Masters by business key.'
              : 'Submitting the validated create and update plan to the background worker.'
          }
        />
      )}
      <InlineAlert variant="info" title="Query-driven Account Partner migration">
        This migration creates or updates Account Partner records only. Referenced Accounts and
        Employee Masters must already exist in the target org. The migration resolves their names
        and IDs in the target, shows the names for review, and uses IDs only for Salesforce lookup
        fields.
      </InlineAlert>

      <FormSection title="Orgs">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="partner-source-org">Source Org</Label>
            <Select
              id="partner-source-org"
              value={sourceOrgId}
              disabled={configurationLocked}
              onChange={(event) => {
                setSourceOrgId(event.target.value);
                invalidatePreview();
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
              disabled={configurationLocked}
              onChange={(event) => {
                setTargetOrgId(event.target.value);
                invalidatePreview();
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
              disabled={configurationLocked}
              onChange={(event) => {
                const next = event.target.value as Bottler;
                setPartnerSoql((current) =>
                  current === defaultPartnerSoql(bottler)
                    ? defaultPartnerSoql(next)
                    : current);
                setBottler(next);
                invalidatePreview();
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
              disabled={configurationLocked}
              onChange={(event) => {
                setRecordLimit(
                  Math.min(100_000, Math.max(1, Number(event.target.value) || 1)),
                );
                invalidatePreview();
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
          disabled={configurationLocked}
          className="min-h-64 font-mono text-xs"
          onChange={(event) => {
            setPartnerSoql(event.target.value);
            invalidatePreview();
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
          disabled={actionDisabled}
          loading={action === 'preview'}
          onClick={() => void handlePreview()}
        >
          Build migration plan
        </Button>
        <Button
          disabled={actionDisabled || !preview?.ok}
          loading={action === 'migrate'}
          onClick={() => void handleMigrate()}
        >
          Create / update Account Partners
        </Button>
      </div>
      {!preview && !jobActive && (
        <p className="-mt-4 text-xs text-muted-foreground">
          Build and review the migration plan before Salesforce changes are enabled.
        </p>
      )}

      {preview && (
        <section className="space-y-5 rounded-xl border border-border/60 bg-card/40 p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold">Migration plan</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Names and business keys below come from the target org. Internal Salesforce IDs are
              resolved in the background and are no longer used as display labels.
            </p>
          </div>
          <InlineAlert
            variant={preview.ok ? 'success' : 'warning'}
            title={preview.ok ? 'Mappings ready' : 'No mappings ready'}
          >
            {preview.stats.ready.toLocaleString()} of{' '}
            {preview.stats.total.toLocaleString()} queried records can be migrated.
          </InlineAlert>
          <InlineAlert
            variant={preview.nameField.mode === 'employee-master-name' ? 'success' : 'warning'}
            title={
              preview.nameField.mode === 'employee-master-name'
                ? 'Employee Master names will be written'
                : 'Salesforce controls the Account Partner Name'
            }
          >
            {preview.nameField.mode === 'employee-master-name'
              ? `The target ${preview.nameField.fieldName} field is writable. Each Account Partner `
                + 'will use its matched Employee Master name instead of an ID.'
              : `The target ${preview.nameField.fieldName} field is auto-numbered or read-only, so `
                + 'Salesforce—not this application—controls that value. The employee name is '
                + 'still shown below and the Employee Master lookup is mapped correctly.'}
          </InlineAlert>
          <StatCardGrid cols={4}>
            <StatCard
              label="Create"
              value={preview.stats.toCreate.toLocaleString()}
              icon={UserRound}
              trend="New Account Partners"
            />
            <StatCard
              label="Update"
              value={preview.stats.toUpdate.toLocaleString()}
              icon={UploadCloud}
              trend="Matched by external ID"
            />
            <StatCard
              label="Skipped"
              value={skippedCount(preview.stats).toLocaleString()}
              icon={Circle}
              trend="No Salesforce changes"
            />
            <StatCard
              label="Source queried"
              value={preview.stats.total.toLocaleString()}
              icon={Database}
              trend={`Maximum ${recordLimit.toLocaleString()}`}
            />
          </StatCardGrid>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
              {preview.targetAccounts.toLocaleString()} target Accounts indexed
            </span>
            <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
              {preview.targetEmployees.toLocaleString()} target Employee Masters indexed
            </span>
          </div>
          {skippedCount(preview.stats) > 0 && (
            <details className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs">
              <summary className="cursor-pointer font-medium">
                Why {skippedCount(preview.stats).toLocaleString()} records will be skipped
              </summary>
              <div className="mt-3 grid gap-x-6 gap-y-2 text-muted-foreground sm:grid-cols-2">
                <p>
                  Missing target Accounts: {preview.stats.skippedTargetAccount.toLocaleString()}
                </p>
                <p>
                  Missing target Employee Masters:{' '}
                  {preview.stats.skippedTargetEmployee.toLocaleString()}
                </p>
                <p>Duplicate mappings: {preview.stats.duplicates.toLocaleString()}</p>
                <p>
                  External ID collisions:{' '}
                  {preview.stats.externalIdCollisions.toLocaleString()}
                </p>
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
            </details>
          )}
          {preview.sample.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Employee Master</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Change</th>
                    <th className="px-3 py-2">External ID</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, index) => (
                    <tr
                      key={`${row.externalId ?? 'mapping'}-${index}`}
                      className="border-t border-border/60"
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-foreground">
                          {row.accountName || 'Account name unavailable'}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          Customer #{row.accountKey}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-foreground">
                          {row.employeeName || 'Employee name unavailable'}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          Employee #{row.employeeKey}
                        </p>
                        {preview.nameField.mode === 'employee-master-name' && (
                          <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                            Written to Account Partner Name
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.role}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 font-medium',
                            row.action === 'create'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                          )}
                        >
                          {row.action === 'create' ? 'Create' : 'Update'}
                        </span>
                      </td>
                      <td className="max-w-56 truncate px-3 py-2 font-mono text-[11px]">
                        {row.externalId}
                      </td>
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
        </section>
      )}

      {jobId && (
        <section className="space-y-5 rounded-xl border border-border/60 bg-card/40 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Account Partner migration</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Job {jobId}
              </p>
            </div>
            {job?.status && <StatusBadge status={job.status} />}
          </div>
          <ol
            aria-label="Migration progress"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {MIGRATION_STEPS.map((step, index) => {
              const done = currentJobStage > index;
              const active = currentJobStage === index && jobActive;
              const failed = currentJobStage === index && jobFailed;
              const StepIcon = step.icon;
              return (
                <li
                  key={step.label}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    done && 'border-emerald-500/30 bg-emerald-500/5',
                    active && 'border-primary/40 bg-primary/5',
                    failed && 'border-destructive/40 bg-destructive/5',
                    !done && !active && !failed && 'border-border/60 bg-background/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full',
                        done && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
                        active && 'bg-primary/10 text-primary',
                        failed && 'bg-destructive/10 text-destructive',
                        !done && !active && !failed && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {done ? (
                        <Check className="size-3.5" />
                      ) : active ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <StepIcon className="size-3.5" />
                      )}
                    </span>
                    <p className="text-xs font-medium">{step.label}</p>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
          {job?.error && <InlineAlert variant="error">{job.error}</InlineAlert>}
          {job?.status === 'completed' && (
            <InlineAlert variant="success" title="Account Partner migration completed">
              {submittedPlan
                ? `${submittedPlan.stats.toCreate.toLocaleString()} records were planned for `
                  + `creation and ${submittedPlan.stats.toUpdate.toLocaleString()} for update.`
                : 'All prepared Account Partner changes were submitted successfully.'}
            </InlineAlert>
          )}
          <details
            key={jobFailed ? 'failed-output' : 'job-output'}
            className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs"
            defaultOpen={jobFailed}
          >
            <summary className="cursor-pointer font-medium">Technical job output</summary>
            <div className="studio-console mt-3 h-52 overflow-y-auto rounded-lg p-3 text-xs">
              {logs.length === 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  {jobActive && <Loader2 className="size-3.5 animate-spin" />}
                  <p>
                    {jobActive ? 'Waiting for worker output…' : 'No job output was captured.'}
                  </p>
                </div>
              )}
              {logs.map((line, index) => <div key={index}>{line}</div>)}
              <div ref={logBottomRef} />
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
