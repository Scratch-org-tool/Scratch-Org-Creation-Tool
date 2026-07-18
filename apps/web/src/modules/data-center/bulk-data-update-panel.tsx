'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
  Search,
  SkipForward,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import {
  FormSection,
  InlineAlert,
  LoadingOverlay,
  StatCard,
  StatCardGrid,
  StatusBadge,
} from '@/components/studio';
import { FileDropzone } from '@/modules/scratch-templates/components/file-dropzone';
import { useOrgs } from '@/hooks/use-orgs';
import { api } from '@/services/api';
import {
  equivalentBulkUpdateHeading,
  fieldAliases,
  suggestTargetField,
} from './bulk-data-update-mapping';

const DEFAULT_OBJECT = 'cfs_ob__EmployeeMaster__c';
const TERMINAL_STATUSES = ['completed', 'partial', 'failed', 'cancelled'];

interface ObjectInfo {
  apiName: string;
  label: string;
}

interface FieldInfo {
  name: string;
  label: string;
  type: string;
  externalId: boolean;
  idLookup: boolean;
  length?: number;
}

interface ObjectMeta {
  objectName: string;
  label: string;
  recommendedMatchField: string;
  fields: FieldInfo[];
  matchFields: FieldInfo[];
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

interface PreviewStats {
  totalRows: number;
  matchedRows: number;
  recordsToUpdate: number;
  fieldChanges: number;
  unchangedRows: number;
  unmatchedRows: number;
  missingMatchRows: number;
  duplicateSourceRows: number;
  ambiguousTargetRows: number;
  invalidRows: number;
}

interface BulkUpdatePreview {
  ok: boolean;
  objectName: string;
  objectLabel: string;
  sheetName: string;
  matchColumn: string;
  matchField: string;
  onlyEmptyFields: boolean;
  mappedFields: Array<{
    sourceColumn: string;
    targetField: string;
    targetLabel: string;
  }>;
  stats: PreviewStats;
  sample: Array<{
    rowNumber: number;
    matchValue: string;
    changes: Array<{
      field: string;
      label: string;
      currentValue: string;
      newValue: string;
    }>;
  }>;
}

interface JobData {
  id: string;
  status: string;
  error?: string | null;
  logs?: Array<{ line: string }>;
}

function sheetFor(
  inspection: WorkbookInspection | null,
  sheetName: string,
): WorkbookSheet | null {
  return inspection?.sheets.find((sheet) => sheet.name === sheetName) ?? null;
}

function displayValue(value: string): string {
  return value === '' ? 'Empty' : value;
}

export function BulkDataUpdatePanel() {
  const { orgs, loading: orgsLoading, error: orgsError } = useOrgs();
  const [targetOrgId, setTargetOrgId] = useState('');
  const [objectName, setObjectName] = useState(DEFAULT_OBJECT);
  const [objects, setObjects] = useState<ObjectInfo[]>([]);
  const [objectMeta, setObjectMeta] = useState<ObjectMeta | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<WorkbookInspection | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [sheetName, setSheetName] = useState('');
  const [matchColumn, setMatchColumn] = useState('');
  const [matchField, setMatchField] = useState('');
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [onlyEmptyFields, setOnlyEmptyFields] = useState(false);
  const [preview, setPreview] = useState<BulkUpdatePreview | null>(null);
  const [submittedPreview, setSubmittedPreview] = useState<BulkUpdatePreview | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [action, setAction] = useState<'preview' | 'run' | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previewGenerationRef = useRef(0);
  const inspectionGenerationRef = useRef(0);

  const jobActive = ['pending', 'queued', 'running'].includes(job?.status ?? '');
  const configurationLocked = action !== null || jobActive;
  const selectedSheet = sheetFor(inspection, sheetName);
  const mappedEntries = useMemo(
    () => Object.entries(mappings)
      .filter(([, targetField]) => targetField)
      .map(([sourceColumn, targetField]) => ({ sourceColumn, targetField })),
    [mappings],
  );

  const invalidatePreview = () => {
    previewGenerationRef.current += 1;
    setPreview(null);
    setReviewed(false);
  };

  useEffect(() => {
    if (!targetOrgId) {
      setObjects([]);
      return;
    }
    const controller = new AbortController();
    void api<ObjectInfo[]>(
      `/data/bulk-update/objects?orgId=${encodeURIComponent(targetOrgId)}`,
      { signal: controller.signal },
    ).then(setObjects).catch((cause) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Could not load Salesforce objects');
    });
    return () => controller.abort();
  }, [targetOrgId]);

  useEffect(() => {
    if (!targetOrgId || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(objectName)) {
      setObjectMeta(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setMetadataLoading(true);
      void api<ObjectMeta>(
        `/data/bulk-update/object-meta?orgId=${encodeURIComponent(targetOrgId)}`
        + `&objectName=${encodeURIComponent(objectName)}`,
        { signal: controller.signal },
      ).then((meta) => {
        setObjectMeta(meta);
        setObjectName(meta.objectName);
        setMatchField(meta.recommendedMatchField);
        setError(null);
      }).catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setObjectMeta(null);
        setError(cause instanceof Error ? cause.message : 'Could not load object fields');
      }).finally(() => setMetadataLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [objectName, targetOrgId]);

  useEffect(() => {
    if (!selectedSheet || !objectMeta) return;
    const recommendedField = objectMeta.matchFields.some(
      (field) => field.name === objectMeta.recommendedMatchField,
    )
      ? objectMeta.recommendedMatchField
      : objectMeta.matchFields[0]?.name ?? '';
    const recommendedFieldMeta = objectMeta.matchFields.find(
      (field) => field.name === recommendedField,
    );
    const suggestedMatchColumn = recommendedFieldMeta
      ? selectedSheet.headers.find((header) =>
          fieldAliases(recommendedFieldMeta)
            .some((alias) => equivalentBulkUpdateHeading(alias, header))) ?? ''
      : '';
    setMatchField(recommendedField);
    setMatchColumn(suggestedMatchColumn);
    setMappings(Object.fromEntries(
      selectedSheet.headers.map((header) => {
        const target = suggestTargetField(header, objectMeta.fields);
        return [header, target === recommendedField ? '' : target];
      }),
    ));
    invalidatePreview();
  // Suggestions intentionally reset only when the parsed sheet or described object changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectMeta, selectedSheet]);

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
        setJob(current);
        setLogs(current.logs?.map((entry) => entry.line) ?? []);
        if (!TERMINAL_STATUSES.includes(current.status)) {
          timer = setTimeout(() => void poll(), 2_000);
        }
      } catch {
        if (disposed) return;
        failures += 1;
        if (failures >= 5) {
          setError(
            'Job status could not be refreshed after multiple attempts. '
            + 'Check Monitoring before starting another update.',
          );
        }
        timer = setTimeout(() => void poll(), failures >= 5 ? 10_000 : 3_000);
      }
    };
    void poll();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const inspectFile = async (nextFile: File | null) => {
    const generation = inspectionGenerationRef.current + 1;
    inspectionGenerationRef.current = generation;
    setFile(nextFile);
    setInspection(null);
    setSheetName('');
    setMatchColumn('');
    setMappings({});
    invalidatePreview();
    if (!nextFile) return;
    if (!/\.(xlsx|xls|csv)$/i.test(nextFile.name)) {
      setError('Upload an .xlsx, .xls, or .csv file');
      setFile(null);
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setError('Workbook exceeds the 10 MB upload limit');
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

  const validateConfiguration = () => {
    if (!targetOrgId) throw new Error('Select a target org');
    if (!objectMeta || objectMeta.objectName !== objectName) {
      throw new Error('Select a valid Salesforce object');
    }
    if (!file || !selectedSheet) throw new Error('Upload a workbook and select a sheet');
    if (!matchColumn || !matchField) {
      throw new Error('Select the spreadsheet and Salesforce matching fields');
    }
    if (mappedEntries.length === 0) throw new Error('Map at least one column to an updateable field');
  };

  const buildForm = () => {
    validateConfiguration();
    const form = new FormData();
    form.append('file', file!, file!.name);
    form.append('targetOrgId', targetOrgId);
    form.append('objectName', objectName);
    form.append('sheetName', sheetName);
    form.append('matchColumn', matchColumn);
    form.append('matchField', matchField);
    form.append('columnMappings', JSON.stringify(mappedEntries));
    form.append('onlyEmptyFields', String(onlyEmptyFields));
    return form;
  };

  const handlePreview = async () => {
    const generation = previewGenerationRef.current + 1;
    previewGenerationRef.current = generation;
    setAction('preview');
    setError(null);
    setReviewed(false);
    try {
      const result = await api<BulkUpdatePreview>('/data/bulk-update/preview', {
        method: 'POST',
        body: buildForm(),
      });
      if (generation === previewGenerationRef.current) setPreview(result);
    } catch (cause) {
      if (generation === previewGenerationRef.current) {
        setPreview(null);
        setError(cause instanceof Error ? cause.message : 'Bulk update preview failed');
      }
    } finally {
      setAction(null);
    }
  };

  const handleRun = async () => {
    setAction('run');
    setError(null);
    setJobId(null);
    setJob(null);
    setLogs([]);
    try {
      if (!preview?.ok || !reviewed) {
        throw new Error('Review and confirm the current update plan before continuing');
      }
      const result = await api<{ jobId: string }>('/data/bulk-update/run', {
        method: 'POST',
        body: buildForm(),
      });
      setSubmittedPreview(preview);
      setJobId(result.jobId);
      setJob({ id: result.jobId, status: 'queued' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bulk data update could not be started');
    } finally {
      setAction(null);
    }
  };

  const previewDisabled =
    !targetOrgId
    || !objectMeta
    || !file
    || !selectedSheet
    || !matchColumn
    || !matchField
    || mappedEntries.length === 0
    || action !== null
    || inspectionLoading
    || metadataLoading
    || jobActive;
  const skippedRows = preview
    ? preview.stats.unmatchedRows
      + preview.stats.missingMatchRows
      + preview.stats.duplicateSourceRows
      + preview.stats.ambiguousTargetRows
      + preview.stats.invalidRows
    : 0;
  const sampleChanges = preview?.sample
    .flatMap((record) => record.changes.map((change) => ({
      ...change,
      rowNumber: record.rowNumber,
      matchValue: record.matchValue,
    })))
    .slice(0, 100) ?? [];

  return (
    <div className="relative space-y-6">
      {(action || inspectionLoading) && (
        <LoadingOverlay
          label={
            inspectionLoading
              ? 'Reading workbook…'
              : action === 'preview'
                ? 'Matching workbook rows…'
                : 'Queueing bulk update…'
          }
          sublabel={
            action === 'preview'
              ? 'Comparing non-empty spreadsheet values with existing Salesforce records.'
              : undefined
          }
        />
      )}

      <InlineAlert variant="info" title="Update existing records only">
        Rows are matched to records already in the selected org. Unmatched, duplicate, or blank-key
        rows are skipped, blank spreadsheet cells never clear Salesforce values, and this operation
        never inserts records.
      </InlineAlert>

      <FormSection
        title="Target"
        description="Employee Master and Employee Number are preselected; choose another object or key when needed."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="bulk-update-org">Target org</Label>
            <Select
              id="bulk-update-org"
              value={targetOrgId}
              disabled={configurationLocked || orgsLoading}
              onChange={(event) => {
                setTargetOrgId(event.target.value);
                setObjectMeta(null);
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
            <Label htmlFor="bulk-update-object">Salesforce object API name</Label>
            <Input
              id="bulk-update-object"
              list="bulk-update-object-options"
              value={objectName}
              disabled={configurationLocked || !targetOrgId}
              onChange={(event) => {
                setObjectName(event.target.value.trim());
                invalidatePreview();
              }}
            />
            <datalist id="bulk-update-object-options">
              {objects.map((object) => (
                <option key={object.apiName} value={object.apiName}>{object.label}</option>
              ))}
            </datalist>
            <p className="mt-1 text-xs text-muted-foreground">
              {metadataLoading
                ? 'Loading fields…'
                : objectMeta
                  ? `${objectMeta.label} · ${objectMeta.fields.length} updateable fields`
                  : 'Enter an object that exists in the selected org.'}
            </p>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Workbook"
        description="The first non-empty row in each sheet is treated as its header row."
      >
        <FileDropzone
          accept=".xlsx,.xls,.csv"
          file={file}
          disabled={configurationLocked}
          label="Drop an Excel or CSV file here"
          hint="Up to 10 MB and 50,000 rows per sheet"
          onFileChange={(nextFile) => void inspectFile(nextFile)}
        />
        {inspection && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="bulk-update-sheet">Sheet</Label>
              <Select
                id="bulk-update-sheet"
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
            <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-sm">
              <p className="font-medium">{selectedSheet?.rowCount.toLocaleString() ?? 0} data rows</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedSheet?.headers.length.toLocaleString() ?? 0} columns detected
              </p>
            </div>
          </div>
        )}
      </FormSection>

      {selectedSheet && objectMeta && (
        <>
          <FormSection
            title="Record matching"
            description="Each unique spreadsheet key must resolve to exactly one existing Salesforce record."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="bulk-update-match-column">Spreadsheet key column</Label>
                <Select
                  id="bulk-update-match-column"
                  value={matchColumn}
                  disabled={configurationLocked}
                  onChange={(event) => {
                    setMatchColumn(event.target.value);
                    invalidatePreview();
                  }}
                >
                  <option value="">Select…</option>
                  {selectedSheet.headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="bulk-update-match-field">Salesforce matching field</Label>
                <Select
                  id="bulk-update-match-field"
                  value={matchField}
                  disabled={configurationLocked}
                  onChange={(event) => {
                    const next = event.target.value;
                    setMatchField(next);
                    setMappings((current) => Object.fromEntries(
                      Object.entries(current).map(([column, field]) => [
                        column,
                        field === next ? '' : field,
                      ]),
                    ));
                    invalidatePreview();
                  }}
                >
                  <option value="">Select…</option>
                  {objectMeta.matchFields.map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.label} ({field.name})
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Column mapping"
            description="Only mapped, non-empty cells are considered. The matching field cannot be changed."
          >
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Spreadsheet column</th>
                    <th className="px-3 py-2">Salesforce field to update</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSheet.headers.map((header) => {
                    const usedTargets = new Set(
                      Object.entries(mappings)
                        .filter(([column]) => column !== header)
                        .map(([, field]) => field)
                        .filter(Boolean),
                    );
                    return (
                      <tr key={header} className="border-t border-border/60">
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{header}</span>
                          {header === matchColumn && (
                            <span className="ml-2 rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-500">
                              Match key
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Select
                            aria-label={`Salesforce field for ${header}`}
                            value={mappings[header] ?? ''}
                            disabled={configurationLocked}
                            onChange={(event) => {
                              setMappings((current) => ({
                                ...current,
                                [header]: event.target.value,
                              }));
                              invalidatePreview();
                            }}
                          >
                            <option value="">Do not update</option>
                            {objectMeta.fields
                              .filter((field) => field.name !== matchField)
                              .map((field) => (
                                <option
                                  key={field.name}
                                  value={field.name}
                                  disabled={usedTargets.has(field.name)}
                                >
                                  {field.label} ({field.name})
                                </option>
                              ))}
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-card/30 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={onlyEmptyFields}
                disabled={configurationLocked}
                onChange={(event) => {
                  setOnlyEmptyFields(event.target.checked);
                  invalidatePreview();
                }}
              />
              <span>
                <span className="font-medium">Fill empty Salesforce fields only</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Leave this off to replace any different value, including an ID incorrectly stored
                  in Name. Turn it on when existing non-empty values must never be changed.
                </span>
              </span>
            </label>
          </FormSection>
        </>
      )}

      {(error || orgsError) && (
        <InlineAlert variant="error" onDismiss={() => setError(null)}>
          {error ?? orgsError}
        </InlineAlert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={previewDisabled}
          loading={action === 'preview'}
          onClick={() => void handlePreview()}
        >
          <Search />
          Preview matched updates
        </Button>
        <Button
          disabled={previewDisabled || !preview?.ok || !reviewed}
          loading={action === 'run'}
          onClick={() => void handleRun()}
        >
          <UploadCloud />
          Update matching records
        </Button>
      </div>

      {preview && (
        <section className="space-y-5 rounded-xl border border-border/60 bg-card/40 p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold">Update plan</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Matched by {preview.matchColumn} → {preview.matchField}. Salesforce record IDs are
              resolved internally and are never used as Name values.
            </p>
          </div>
          <InlineAlert
            variant={preview.ok ? 'success' : 'warning'}
            title={preview.ok ? 'Matched changes are ready' : 'No eligible changes found'}
          >
            {preview.stats.recordsToUpdate.toLocaleString()} existing records will be updated and
            0 records will be created.
          </InlineAlert>
          <StatCardGrid cols={4}>
            <StatCard
              label="Workbook rows"
              value={preview.stats.totalRows.toLocaleString()}
              icon={FileSpreadsheet}
            />
            <StatCard
              label="Records to update"
              value={preview.stats.recordsToUpdate.toLocaleString()}
              icon={UploadCloud}
              trend={`${preview.stats.fieldChanges.toLocaleString()} field changes`}
            />
            <StatCard
              label="Already correct"
              value={preview.stats.unchangedRows.toLocaleString()}
              icon={CheckCircle2}
            />
            <StatCard
              label="Skipped"
              value={skippedRows.toLocaleString()}
              icon={SkipForward}
              trend="No Salesforce changes"
            />
          </StatCardGrid>
          {skippedRows > 0 && (
            <details className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs">
              <summary className="cursor-pointer font-medium">
                Why {skippedRows.toLocaleString()} workbook rows will be skipped
              </summary>
              <div className="mt-3 grid gap-2 text-muted-foreground sm:grid-cols-2">
                <p>Not found in target org: {preview.stats.unmatchedRows.toLocaleString()}</p>
                <p>Missing matching value: {preview.stats.missingMatchRows.toLocaleString()}</p>
                <p>Duplicate workbook keys: {preview.stats.duplicateSourceRows.toLocaleString()}</p>
                <p>
                  Duplicate target keys: {preview.stats.ambiguousTargetRows.toLocaleString()}
                </p>
                <p>Invalid values: {preview.stats.invalidRows.toLocaleString()}</p>
              </div>
            </details>
          )}
          {sampleChanges.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Sheet row</th>
                    <th className="px-3 py-2">Match value</th>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Current org value</th>
                    <th className="px-3 py-2">Workbook value</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleChanges.map((change, index) => (
                    <tr
                      key={`${change.rowNumber}-${change.field}-${index}`}
                      className="border-t border-border/60"
                    >
                      <td className="px-3 py-2">{change.rowNumber}</td>
                      <td className="px-3 py-2 font-mono">{change.matchValue}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{change.label}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{change.field}</p>
                      </td>
                      <td className="max-w-64 truncate px-3 py-2">
                        {displayValue(change.currentValue)}
                      </td>
                      <td className="max-w-64 truncate px-3 py-2 font-medium">
                        {displayValue(change.newValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.ok && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={reviewed}
                disabled={jobActive}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              <span>
                I reviewed this plan and confirm that only these matched existing records should be
                updated.
              </span>
            </label>
          )}
        </section>
      )}

      {jobId && (
        <section className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Bulk data update</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">Job {jobId}</p>
            </div>
            {job?.status && <StatusBadge status={job.status} />}
          </div>
          {jobActive && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Matching again against current org data and applying the update-only CSV…
            </div>
          )}
          {job?.status === 'completed' && (
            <InlineAlert variant="success" title="Bulk data update completed">
              {submittedPreview?.stats.recordsToUpdate.toLocaleString() ?? 'All planned'} existing
              records were submitted for update. No records were inserted.
            </InlineAlert>
          )}
          {job?.error && <InlineAlert variant="error">{job.error}</InlineAlert>}
          <details className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs">
            <summary className="cursor-pointer font-medium">Technical job output</summary>
            <div className="studio-console mt-3 max-h-64 overflow-y-auto rounded-lg p-3">
              {logs.length === 0
                ? <p className="text-muted-foreground">Waiting for worker output…</p>
                : logs.map((line, index) => <div key={index}>{line}</div>)}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
