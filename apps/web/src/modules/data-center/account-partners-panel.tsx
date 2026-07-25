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
import {
  FileDropzone,
} from '@/modules/scratch-templates/components/file-dropzone';
import {
  BULK_DATA_UPDATE_MAX_FILE_BYTES,
  bulkDataUpdateMaxFileSizeLabel,
  ACCOUNT_PARTNER_EXCEL_ASYNC_PREVIEW_MIN_ROWS,
  validateAccountPartnerExcelHeaders,
} from '@sfcc/shared';

type Bottler = '5000' | '4900' | '4600';
type MigrationMode = 'soql' | 'excel';

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
  skippedNoDistributionMatch: number;
  skippedPerOfficeLimit: number;
}

interface MappingPreview {
  ok: boolean;
  query: string;
  stats: MigrationStats;
  targetAccounts: number;
  targetEmployees: number;
  matchOrgDistribution?: boolean;
  distributionAccountsIndexed?: number;
  skippedNoDistributionMatch?: number;
  perOffice?: number;
  matchedBeforePerOfficeLimit?: number;
  prepareCacheKey?: string;
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
  payload?: {
    previewResult?: MappingPreview;
    rowCount?: number;
    fileSize?: number;
  };
}

interface WorkbookSheet {
  name: string;
  headers: string[];
  rowCount: number;
}

interface WorkbookInspection {
  fileName: string;
  defaultSheet: string;
  sheets: WorkbookSheet[];
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
  cfs_ob__Account__r.AccountNumber,
  cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c
FROM cfs_ob__AccountPartner__c
WHERE cfs_ob__Bottler__c = '${bottler}'`;
}

function skippedCount(stats: MigrationStats) {
  return stats.total - stats.ready;
}

function sheetFor(
  inspection: WorkbookInspection | null,
  sheetName: string,
): WorkbookSheet | null {
  return inspection?.sheets.find((sheet) => sheet.name === sheetName) ?? null;
}

export function AccountPartnersPanel() {
  const { orgs } = useOrgs();
  const [mode, setMode] = useState<MigrationMode>('excel');
  const [sourceOrgId, setSourceOrgId] = useState('');
  const [targetOrgId, setTargetOrgId] = useState('');
  const [bottler, setBottler] = useState<Bottler>('5000');
  const [recordLimit, setRecordLimit] = useState(10_000);
  const [partnerSoql, setPartnerSoql] = useState(() => defaultPartnerSoql('5000'));
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<WorkbookInspection | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [sheetName, setSheetName] = useState('');
  const [matchOrgDistribution, setMatchOrgDistribution] = useState(true);
  const [limitPerOffice, setLimitPerOffice] = useState(true);
  const [perOffice, setPerOffice] = useState(20);
  const [preview, setPreview] = useState<MappingPreview | null>(null);
  const [submittedPlan, setSubmittedPlan] = useState<MappingPreview | null>(null);
  const [action, setAction] = useState<'preview' | 'migrate' | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [jobOutputOpen, setJobOutputOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logBottomRef = useRef<HTMLDivElement>(null);
  const previewGenerationRef = useRef(0);
  const inspectionGenerationRef = useRef(0);

  const selectedSheet = sheetFor(inspection, sheetName);
  const headerValidation = useMemo(
    () => validateAccountPartnerExcelHeaders(selectedSheet?.headers ?? []),
    [selectedSheet?.headers],
  );

  const soqlPayload = useMemo(() => ({
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
    if (!previewJobId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const poll = async () => {
      try {
        const current = await api<JobData>(`/jobs/${previewJobId}`, { direct: true });
        if (disposed) return;
        failures = 0;
        setJob(current);
        setLogs(current.logs?.map((entry) => entry.line) ?? []);
        const progressMatch = [...(current.logs ?? [])]
          .reverse()
          .find((entry) => /\[progress:\d+\]/.test(entry.line));
        if (progressMatch) {
          const pct = parseInt(progressMatch.line.match(/\[progress:(\d+)\]/)?.[1] ?? '0', 10);
          setPreviewProgress(pct);
        }
        if (current.status === 'completed' && current.payload?.previewResult) {
          setPreview(current.payload.previewResult);
          setPreviewProgress(0);
          setPreviewJobId(null);
          setAction(null);
          setJobOutputOpen(false);
          return;
        }
        if (['failed', 'partial', 'cancelled'].includes(current.status)) {
          setError(current.error ?? 'Account Partner preview failed');
          setPreviewJobId(null);
          setAction(null);
          setJobOutputOpen(true);
          return;
        }
        timer = setTimeout(poll, 3_000);
      } catch (cause) {
        if (disposed) return;
        failures += 1;
        if (failures >= 5) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Preview status could not be refreshed. Check Monitoring and try again.',
          );
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
  }, [previewJobId]);

  useEffect(() => {
    if (!jobId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const poll = async () => {
      try {
        const current = await api<JobData>(`/jobs/${jobId}`, { direct: true });
        if (disposed) return;
        failures = 0;
        setError(null);
        setJob(current);
        setLogs(current.logs?.map((entry) => entry.line) ?? []);
        if (['failed', 'partial', 'cancelled'].includes(current.status)) {
          setJobOutputOpen(true);
        }
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

  const handleFileChange = async (nextFile: File | null) => {
    const generation = inspectionGenerationRef.current + 1;
    inspectionGenerationRef.current = generation;
    setFile(nextFile);
    setInspection(null);
    setSheetName('');
    invalidatePreview();
    if (!nextFile) return;
    if (!/\.(xlsx|xls)$/i.test(nextFile.name)) {
      setError('Upload an .xlsx or .xls file');
      setFile(null);
      return;
    }
    if (nextFile.size > BULK_DATA_UPDATE_MAX_FILE_BYTES) {
      setError(`Workbook exceeds the ${bulkDataUpdateMaxFileSizeLabel()} upload limit`);
      setFile(null);
      return;
    }
    setInspectionLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', nextFile, nextFile.name);
      const result = await api<WorkbookInspection>('/data/bulk-update/inspect', {
        method: 'POST',
        body: form,
        direct: true,
      });
      if (generation !== inspectionGenerationRef.current) return;
      setInspection(result);
      const firstSheet = result.sheets.find((sheet) => sheet.headers.length > 0);
      setSheetName(firstSheet?.name ?? result.defaultSheet);
    } catch (cause) {
      if (generation !== inspectionGenerationRef.current) return;
      setError(cause instanceof Error ? cause.message : 'Workbook inspection failed');
      setFile(null);
    } finally {
      if (generation === inspectionGenerationRef.current) setInspectionLoading(false);
    }
  };

  const validateSoql = () => {
    if (!sourceOrgId || !targetOrgId) throw new Error('Select source and target orgs');
    if (sourceOrgId === targetOrgId) throw new Error('Source and target org must differ');
    if (!partnerSoql.trim()) throw new Error('Enter an Account Partner SOQL query');
  };

  const validateExcel = () => {
    if (!targetOrgId) throw new Error('Select a target org');
    if (!file || !selectedSheet) throw new Error('Upload a partner spreadsheet and select a sheet');
    if (!headerValidation.ok) {
      throw new Error(
        `Spreadsheet is missing required columns: ${headerValidation.missing.join(', ')}`,
      );
    }
  };

  const buildExcelForm = (includePrepareCache = false) => {
    validateExcel();
    const form = new FormData();
    form.append('file', file!, file!.name);
    form.append('targetOrgId', targetOrgId);
    form.append('bottler', bottler);
    form.append('matchOrgDistribution', String(matchOrgDistribution));
    if (limitPerOffice) form.append('perOffice', String(perOffice));
    if (sheetName) form.append('sheet', sheetName);
    if (selectedSheet) form.append('rowCount', String(selectedSheet.rowCount));
    if (includePrepareCache && preview?.prepareCacheKey) {
      form.append('prepareCacheKey', preview.prepareCacheKey);
    }
    return form;
  };

  const validate = () => {
    if (mode === 'soql') validateSoql();
    else validateExcel();
  };

  const handlePreview = async () => {
    const generation = previewGenerationRef.current + 1;
    previewGenerationRef.current = generation;
    setError(null);
    setAction('preview');
    let asyncPreviewJobId: string | null = null;
    try {
      validate();
      if (mode === 'soql') {
        const result = await api<MappingPreview>('/data/account-partners/mapping/preview', {
          method: 'POST',
          body: JSON.stringify(soqlPayload),
        });
        if (generation === previewGenerationRef.current) setPreview(result);
        return;
      }
      const result = await api<MappingPreview | { jobId: string; async: true }>(
        '/data/account-partners/excel/mapping/preview',
        {
          method: 'POST',
          body: buildExcelForm(),
          direct: true,
        },
      );
      if (generation !== previewGenerationRef.current) return;
      if ('jobId' in result && result.async) {
        asyncPreviewJobId = result.jobId;
        setPreview(null);
        setPreviewJobId(result.jobId);
        setJob({ id: result.jobId, status: 'queued' });
        setLogs([]);
        setJobOutputOpen(true);
        return;
      }
      setPreview(result as MappingPreview);
    } catch (cause) {
      if (generation === previewGenerationRef.current) {
        setPreview(null);
        setError(cause instanceof Error ? cause.message : 'Account Partner preview failed');
      }
    } finally {
      if (!asyncPreviewJobId) setAction(null);
    }
  };

  const handleMigrate = async () => {
    setError(null);
    setAction('migrate');
    setPreviewJobId(null);
    setJobId(null);
    setJob(null);
    setLogs([]);
    setJobOutputOpen(false);
    setSubmittedPlan(null);
    try {
      validate();
      const migrationPlan = preview;
      if (!migrationPlan?.ok) {
        throw new Error('Build a valid migration plan before starting the migration');
      }
      const endpoint = mode === 'soql'
        ? '/data/account-partners/mapping/run'
        : '/data/account-partners/excel/mapping/run';
      const result = mode === 'soql'
        ? await api<{ jobId: string }>(endpoint, {
          method: 'POST',
          body: JSON.stringify(soqlPayload),
        })
        : await api<{ jobId: string }>(endpoint, {
          method: 'POST',
          body: buildExcelForm(true),
          direct: true,
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

  const jobActive = previewJobId !== null
    || (jobId !== null && ['pending', 'queued', 'running'].includes(job?.status ?? ''));
  const configurationLocked = action !== null || jobActive || inspectionLoading;
  const soqlActionDisabled =
    !sourceOrgId
    || !targetOrgId
    || sourceOrgId === targetOrgId
    || !partnerSoql.trim()
    || action !== null
    || jobActive;
  const excelActionDisabled =
    !targetOrgId
    || !file
    || !selectedSheet
    || !headerValidation.ok
    || action !== null
    || jobActive
    || inspectionLoading;
  const actionDisabled = mode === 'soql' ? soqlActionDisabled : excelActionDisabled;
  const currentJobStage = migrationStage(job, logs);
  const jobFailed = ['failed', 'partial', 'cancelled'].includes(job?.status ?? '');

  return (
    <div className="relative space-y-6">
      {(action || previewJobId) && (
        <LoadingOverlay
          label={previewJobId || action === 'preview' ? 'Building migration plan…' : 'Starting migration…'}
          sublabel={
            previewJobId
              ? ((logs[logs.length - 1] ?? '').replace(/\[progress:\d+\]\s*/, '') || 'Large workbook — matching runs in the background. Keep this tab open.')
              : action === 'preview'
                ? 'Matching source records to target Accounts and Employee Masters by business key.'
                : 'Submitting the validated create and update plan to the background worker.'
          }
          progress={previewJobId ? previewProgress : undefined}
        />
      )}
      <InlineAlert variant="info" title="Account Partner migration">
        {mode === 'soql'
          ? 'Query-driven migration creates or updates Account Partner records only. Referenced Accounts and Employee Masters must already exist in the target org.'
          : 'Upload a Salesforce-export spreadsheet with employee number and account number columns. Referenced Accounts and Employee Masters must already exist in the target org.'}
      </InlineAlert>

      <FormSection title="Migration source">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'excel' ? 'default' : 'outline'}
            disabled={configurationLocked}
            onClick={() => {
              setMode('excel');
              invalidatePreview();
            }}
          >
            From Excel spreadsheet
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'soql' ? 'default' : 'outline'}
            disabled={configurationLocked}
            onClick={() => {
              setMode('soql');
              invalidatePreview();
            }}
          >
            From source org (SOQL)
          </Button>
        </div>
      </FormSection>

      <FormSection title="Orgs">
        <div className={cn('grid gap-4', mode === 'soql' ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
          {mode === 'soql' && (
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
          )}
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
          {mode === 'soql' && (
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
          )}
        </div>
      </FormSection>

      {mode === 'excel' ? (
        <FormSection title="Partner spreadsheet">
          <p className="mb-3 text-xs text-muted-foreground">
            Use a Salesforce export with employee number, account number, bottler, sales office,
            and partner role columns.
          </p>
          <FileDropzone
            accept=".xlsx,.xls"
            label="Drop partner Excel workbook"
            hint={`.xlsx or .xls — up to ${bulkDataUpdateMaxFileSizeLabel()}. No row limit; large files can take several minutes to load.`}
            file={file}
            disabled={configurationLocked}
            onFileChange={(nextFile) => void handleFileChange(nextFile)}
          />
          {inspectionLoading && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Inspecting workbook… Large sheets may take several minutes to parse.
            </p>
          )}
          {inspection && inspection.sheets.length > 1 && (
            <div className="mt-4">
              <Label htmlFor="partner-sheet">Worksheet</Label>
              <Select
                id="partner-sheet"
                value={sheetName}
                disabled={configurationLocked}
                onChange={(event) => {
                  setSheetName(event.target.value);
                  invalidatePreview();
                }}
              >
                {inspection.sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name} ({sheet.rowCount.toLocaleString()} rows)
                  </option>
                ))}
              </Select>
            </div>
          )}
          {selectedSheet && (
            <div className="mt-4 space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={matchOrgDistribution}
                  disabled={configurationLocked}
                  onChange={(event) => {
                    setMatchOrgDistribution(event.target.checked);
                    invalidatePreview();
                  }}
                />
                <span>
                  <span className="font-medium">Match target distribution accounts</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Use when the spreadsheet was exported from another org. Source account and
                    customer numbers are remapped to distribution accounts in the target org.
                    Employee numbers must still exist in the target.
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={limitPerOffice}
                    disabled={configurationLocked}
                    onChange={(event) => {
                      setLimitPerOffice(event.target.checked);
                      invalidatePreview();
                    }}
                  />
                  <span>
                    <span className="font-medium">Limit partners per sales office</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Keeps only the first unique employee and role pairs per sales office.
                      Uncheck to migrate every matched row.
                    </span>
                  </span>
                </label>
                {limitPerOffice && (
                  <div className="min-w-32">
                    <Label htmlFor="partner-per-office">Max per office</Label>
                    <Input
                      id="partner-per-office"
                      type="number"
                      min={1}
                      max={500}
                      value={perOffice}
                      disabled={configurationLocked}
                      onChange={(event) => {
                        setPerOffice(Math.min(500, Math.max(1, Number(event.target.value) || 1)));
                        invalidatePreview();
                      }}
                    />
                  </div>
                )}
              </div>
              <InlineAlert
                variant={headerValidation.ok ? 'success' : 'warning'}
                title={
                  headerValidation.ok
                    ? 'Required Salesforce columns detected'
                    : 'Missing required Salesforce columns'
                }
              >
                {headerValidation.ok
                  ? `${selectedSheet.rowCount.toLocaleString()} spreadsheet rows include employee number and account number fields.`
                  : `Add or rename columns: ${headerValidation.missing.join(', ')}`}
              </InlineAlert>
              {headerValidation.detected.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Detected: {headerValidation.detected.join(', ')}
                </p>
              )}
            </div>
          )}
        </FormSection>
      ) : (
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
      )}

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
            variant={preview.nameField.mode === 'employee-master-name' ? 'success' : 'info'}
            title={
              preview.nameField.mode === 'employee-master-name'
                ? 'Employee Master names will be written'
                : 'Name is auto-assigned by Salesforce (expected)'
            }
          >
            {preview.nameField.mode === 'employee-master-name'
              ? `The target ${preview.nameField.fieldName} field is writable. Each Account Partner `
                + 'will use its matched Employee Master name instead of an ID.'
              : `In this target org, ${preview.nameField.fieldName} is auto-numbered or read-only, `
                + 'so Salesforce assigns it on create. That does not block migration — Account, '
                + 'Employee Master, role, and external ID are still mapped. Employee names shown '
                + 'in the plan are for review only.'}
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
              trend={
                mode === 'soql'
                  ? `Maximum ${recordLimit.toLocaleString()}`
                  : `${selectedSheet?.rowCount.toLocaleString() ?? preview.stats.total.toLocaleString()} spreadsheet rows`
              }
            />
          </StatCardGrid>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
              {preview.targetAccounts.toLocaleString()} target Accounts indexed
            </span>
            <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
              {preview.targetEmployees.toLocaleString()} target Employee Masters indexed
            </span>
            {mode === 'excel' && preview.matchOrgDistribution && (
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
                {(preview.distributionAccountsIndexed ?? 0).toLocaleString()} distribution
                accounts indexed
              </span>
            )}
          </div>
          {mode === 'excel' && preview.matchOrgDistribution && (
            <p className="text-xs text-muted-foreground">
              Distribution remapping is enabled. Employee numbers in the spreadsheet must still
              match Employee Masters in the target org.
            </p>
          )}
          {mode === 'excel' && preview.perOffice && (
            <p className="text-xs text-muted-foreground">
              Per-sales-office limit of {preview.perOffice.toLocaleString()} is enabled.
              {(preview.matchedBeforePerOfficeLimit ?? 0) > preview.stats.ready && (
                <>
                  {' '}
                  Full-sheet match found{' '}
                  {(preview.matchedBeforePerOfficeLimit ?? 0).toLocaleString()} Account/Employee
                  pairs; {preview.stats.ready.toLocaleString()} are ready after the per-office
                  cap
                  {(preview.stats.skippedPerOfficeLimit ?? 0) > 0
                    ? ` (${preview.stats.skippedPerOfficeLimit.toLocaleString()} over the limit)`
                    : ''}
                  .
                </>
              )}
            </p>
          )}
          {skippedCount(preview.stats) > 0 && (
            <details className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs">
              <summary className="cursor-pointer font-medium">
                Why {skippedCount(preview.stats).toLocaleString()} records will be skipped
              </summary>
              <div className="mt-3 grid gap-x-6 gap-y-2 text-muted-foreground sm:grid-cols-2">
                <p>
                  Missing target Accounts: {preview.stats.skippedTargetAccount.toLocaleString()}
                </p>
                {mode === 'excel' && (preview.stats.skippedPerOfficeLimit ?? 0) > 0 && (
                  <p>
                    Over per-office limit:{' '}
                    {preview.stats.skippedPerOfficeLimit.toLocaleString()}
                  </p>
                )}
                {mode === 'excel' && (preview.skippedNoDistributionMatch ?? preview.stats.skippedNoDistributionMatch ?? 0) > 0 && (
                  <p>
                    No distribution account match:{' '}
                    {(preview.skippedNoDistributionMatch ?? preview.stats.skippedNoDistributionMatch)
                      .toLocaleString()}
                  </p>
                )}
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
            className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs"
            open={jobOutputOpen}
            onToggle={(event) => setJobOutputOpen(event.currentTarget.open)}
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
