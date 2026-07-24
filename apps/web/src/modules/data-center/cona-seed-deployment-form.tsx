'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { FormSection, GlassCard, InlineAlert, StatusBadge } from '@/components/studio';
import { api } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';
import { Code2, Plus, Trash2 } from 'lucide-react';

interface Org {
  id: string;
  alias: string;
}

type AccountGroup = 'Z001' | 'ZFSV' | 'Z003';
type Bottler = '5000' | '4900' | '4600';
type DistributionChannel = 'Z1' | 'Z3';
type Dataset = 'OnboardingConfig' | 'Products' | 'VisitPlans' | 'Accounts';
type AccountQueryMode = 'guided' | 'manual';
type OnboardingQueryMode = 'automatic' | 'manual';

interface AccountSeedRow {
  accountGroup: AccountGroup;
  bottler: Bottler;
  distributionChannel: DistributionChannel;
  limit: number;
}

interface ManualAccountQuery {
  id: string;
  label: string;
  soql: string;
  limit: number;
}

type ManualOnboardingQuery = ManualAccountQuery;

interface ManualOnboardingPreview extends ManualOnboardingQuery {
  availableCount: number;
  selectedCount: number;
  soql: string;
  excludedFields: Array<{ field: string; reason: string }>;
  expandedCompoundFields: Array<{ field: string; components: string[] }>;
}

interface SeedValidationCheck {
  dataset: string;
  count: number;
  ok: boolean;
  availableCount?: number;
  requestedMaximum?: number;
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

const DEFAULT_MANUAL_QUERY: ManualAccountQuery = {
  id: 'manual-account-1',
  label: 'Manual Account query 1',
  soql: '',
  limit: 500,
};

const DEFAULT_ONBOARDING_QUERY: ManualOnboardingQuery = {
  id: 'manual-onboarding-1',
  label: 'Manual OnboardingConfig query 1',
  soql: '',
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
  const [accountQueryMode, setAccountQueryMode] = useState<AccountQueryMode>('guided');
  const [manualQueries, setManualQueries] = useState<ManualAccountQuery[]>([
    { ...DEFAULT_MANUAL_QUERY },
  ]);
  const [onboardingQueryMode, setOnboardingQueryMode] =
    useState<OnboardingQueryMode>('automatic');
  const [manualOnboardingQueries, setManualOnboardingQueries] =
    useState<ManualOnboardingQuery[]>([{ ...DEFAULT_ONBOARDING_QUERY }]);
  const [preview, setPreview] = useState<{
    ok?: boolean;
    checks?: SeedValidationCheck[];
    rows?: Array<AccountSeedRow & { availableCount: number; soql: string }>;
    manualQueries?: Array<ManualAccountQuery & {
      availableCount: number;
      selectedCount: number;
      soql: string;
    }>;
    manualOnboardingQueries?: ManualOnboardingPreview[];
  } | null>(null);
  const [loadingAction, setLoadingAction] = useState<'preview' | 'run' | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logBottomRef = useRef<HTMLDivElement>(null);
  const manualQuerySequence = useRef(2);
  const manualOnboardingSequence = useRef(2);

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

  const accountSeedPayload =
    datasets.includes('Accounts') && accountQueryMode === 'guided'
      ? accountRows
      : undefined;
  const manualAccountQueryPayload =
    datasets.includes('Accounts') && accountQueryMode === 'manual'
      ? manualQueries
      : undefined;
  const manualOnboardingQueryPayload =
    datasets.includes('OnboardingConfig') && onboardingQueryMode === 'manual'
      ? manualOnboardingQueries
      : undefined;

  const validateSelection = useCallback(() => {
    if (datasets.length === 0) throw new Error('Select at least one dataset');
    if (datasets.includes('OnboardingConfig') && onboardingQueryMode === 'manual') {
      if (manualOnboardingQueries.length === 0) {
        throw new Error('Add at least one manual OnboardingConfig query');
      }
      for (const [index, query] of manualOnboardingQueries.entries()) {
        if (!query.label.trim()) {
          throw new Error(`Manual OnboardingConfig query ${index + 1} needs a label`);
        }
        if (!query.soql.trim()) {
          throw new Error(`Manual query "${query.label}" needs SOQL`);
        }
      }
    }
    if (!datasets.includes('Accounts')) return;
    if (accountQueryMode === 'guided') {
      const blocked = accountRows.find(isZfsv5000Blocked);
      if (blocked) throw new Error('ZFSV accounts are not available for bottler 5000');
      return;
    }
    if (manualQueries.length === 0) throw new Error('Add at least one manual Account query');
    for (const [index, query] of manualQueries.entries()) {
      if (!query.label.trim()) throw new Error(`Manual query ${index + 1} needs a label`);
      if (!query.soql.trim()) throw new Error(`Manual query "${query.label}" needs SOQL`);
    }
  }, [
    accountQueryMode,
    accountRows,
    datasets,
    manualOnboardingQueries,
    manualQueries,
    onboardingQueryMode,
  ]);

  const seedPayload = {
    sourceOrgId,
    targetOrgId,
    datasets,
    accountQueryMode,
    accountSeedRows: accountSeedPayload,
    manualAccountQueries: manualAccountQueryPayload,
    onboardingQueryMode,
    manualOnboardingQueries: manualOnboardingQueryPayload,
  };

  const handlePreview = async () => {
    if (!sourceOrgId || !targetOrgId) {
      setError('Select both a source org and a target org.');
      return;
    }
    if (sourceOrgId === targetOrgId) {
      setError('Source and target org must differ.');
      return;
    }
    setError(null);
    setLoadingAction('preview');
    try {
      validateSelection();
      const [validation, accountPreview] = await Promise.all([
        api<{
          ok: boolean;
          checks: SeedValidationCheck[];
          manualQueries?: Array<ManualAccountQuery & {
            availableCount: number;
            selectedCount: number;
            soql: string;
          }>;
          manualOnboardingQueries?: ManualOnboardingPreview[];
        }>(
          '/data/seed/preview',
          {
            method: 'POST',
            body: JSON.stringify(seedPayload),
          },
        ),
        datasets.includes('Accounts') && accountQueryMode === 'guided'
          ? api<{ rows: Array<AccountSeedRow & { availableCount: number; soql: string }> }>(
              '/data/account-seed/preview',
              {
                method: 'POST',
                body: JSON.stringify({ sourceOrgId, rows: accountRows }),
              },
            )
          : Promise.resolve(null),
      ]);
      setPreview({
        ok: validation.ok,
        checks: validation.checks,
        rows: accountPreview?.rows,
        manualQueries: validation.manualQueries,
        manualOnboardingQueries: validation.manualOnboardingQueries,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setPreview(null);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRun = async () => {
    if (!sourceOrgId || !targetOrgId) return;
    if (sourceOrgId === targetOrgId) {
      setError('Source and target org must differ.');
      return;
    }
    setError(null);
    setLoadingAction('run');
    setLogs([]);
    setJob(null);
    setJobId(null);
    try {
      validateSelection();
      const res = await api<{ jobId: string }>('/data/seed/run', {
        method: 'POST',
        body: JSON.stringify(seedPayload),
      });
      setJobId(res.jobId);
      setJob({ id: res.jobId, status: 'queued' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed run failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const updateRow = (index: number, patch: Partial<AccountSeedRow>) => {
    setAccountRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setPreview(null);
  };

  const updateManualQuery = (index: number, patch: Partial<ManualAccountQuery>) => {
    setManualQueries((queries) =>
      queries.map((query, queryIndex) =>
        queryIndex === index ? { ...query, ...patch } : query));
    setPreview(null);
  };

  const addManualQuery = () => {
    const sequence = manualQuerySequence.current++;
    setManualQueries((queries) => [
      ...queries,
      {
        id: `manual-account-${sequence}`,
        label: `Manual Account query ${sequence}`,
        soql: '',
        limit: 500,
      },
    ]);
    setPreview(null);
  };

  const updateManualOnboardingQuery = (
    index: number,
    patch: Partial<ManualOnboardingQuery>,
  ) => {
    setManualOnboardingQueries((queries) =>
      queries.map((query, queryIndex) =>
        queryIndex === index ? { ...query, ...patch } : query));
    setPreview(null);
  };

  const addManualOnboardingQuery = () => {
    const sequence = manualOnboardingSequence.current++;
    setManualOnboardingQueries((queries) => [
      ...queries,
      {
        id: `manual-onboarding-${sequence}`,
        label: `Manual OnboardingConfig query ${sequence}`,
        soql: '',
        limit: 500,
      },
    ]);
    setPreview(null);
  };

  const isRunning =
    job?.status === 'running'
    || job?.status === 'queued'
    || loadingAction !== null;

  const formContent = (
    <>
        <FormSection title="Orgs">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="cona-seed-source-org">Source Org</Label>
              <Select id="cona-seed-source-org" value={sourceOrgId} onChange={(e) => setSourceOrgId(e.target.value)}>
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.alias}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cona-seed-target-org">Target Org</Label>
              <Select id="cona-seed-target-org" value={targetOrgId} onChange={(e) => setTargetOrgId(e.target.value)}>
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
                    setPreview(null);
                  }}
                />
                {d}
              </label>
            ))}
          </div>
        </FormSection>

        {datasets.includes('OnboardingConfig') && (
          <FormSection title="OnboardingConfig query" className="mt-6">
            <div className="max-w-sm mb-4">
              <Label htmlFor="cona-onboarding-query-mode">Selection mode</Label>
              <Select
                id="cona-onboarding-query-mode"
                value={onboardingQueryMode}
                onChange={(event) => {
                  setOnboardingQueryMode(event.target.value as OnboardingQueryMode);
                  setPreview(null);
                  setError(null);
                }}
              >
                <option value="automatic">Built-in query</option>
                <option value="manual">Manual SOQL</option>
              </Select>
            </div>

            {onboardingQueryMode === 'automatic' ? (
              <p className="text-xs text-muted-foreground">
                Uses the built-in primary-group onboarding query.
              </p>
            ) : (
              <>
                <InlineAlert variant="info" title="Manual OnboardingConfig SOQL">
                  Queries must target <code>cfs_ob__Onboarding_Config__c</code> and select{' '}
                  <code>RecordTypeId</code> plus at least one field to seed. Source record IDs are
                  removed and RecordType IDs are mapped to the target org. The maximum records
                  value replaces any LIMIT in the query. Compound Address and Geolocation fields
                  are expanded into Bulk-compatible components; non-createable fields are shown
                  and excluded during preview.
                </InlineAlert>
                <div className="space-y-3 mt-3">
                  {manualOnboardingQueries.map((query, index) => (
                    <div key={query.id} className="rounded-lg border border-border p-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto] items-end">
                        <div>
                          <Label htmlFor={`cona-onboarding-${query.id}-label`}>Query label</Label>
                          <Input
                            id={`cona-onboarding-${query.id}-label`}
                            value={query.label}
                            maxLength={120}
                            onChange={(event) =>
                              updateManualOnboardingQuery(index, { label: event.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`cona-onboarding-${query.id}-limit`}>
                            Maximum records
                          </Label>
                          <Input
                            id={`cona-onboarding-${query.id}-limit`}
                            type="number"
                            min={1}
                            max={100_000}
                            value={query.limit}
                            onChange={(event) =>
                              updateManualOnboardingQuery(index, {
                                limit: Math.min(
                                  100_000,
                                  Math.max(1, Number(event.target.value) || 1),
                                ),
                              })
                            }
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Upper bound; matched records may be lower.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={manualOnboardingQueries.length === 1}
                          onClick={() => {
                            setManualOnboardingQueries((queries) =>
                              queries.filter((_, queryIndex) => queryIndex !== index));
                            setPreview(null);
                          }}
                          aria-label={`Remove manual OnboardingConfig query ${index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div>
                        <Label htmlFor={`cona-onboarding-${query.id}-soql`}>SOQL query</Label>
                        <Textarea
                          id={`cona-onboarding-${query.id}-soql`}
                          value={query.soql}
                          className="min-h-36 font-mono text-xs"
                          placeholder={
                            'SELECT RecordTypeId, cfs_ob__Bottler__c, '
                            + 'cfs_ob__Business_Unit__c FROM '
                            + 'cfs_ob__Onboarding_Config__c WHERE ...'
                          }
                          onChange={(event) =>
                            updateManualOnboardingQuery(index, { soql: event.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1"
                  onClick={addManualOnboardingQuery}
                >
                  <Code2 className="w-4 h-4" />
                  Add OnboardingConfig query
                </Button>
              </>
            )}
          </FormSection>
        )}

        {datasets.includes('Accounts') && (
          <FormSection title="Account queries" className="mt-6">
            <div className="max-w-sm mb-4">
              <Label htmlFor="cona-account-query-mode">Account selection mode</Label>
              <Select
                id="cona-account-query-mode"
                value={accountQueryMode}
                onChange={(event) => {
                  setAccountQueryMode(event.target.value as AccountQueryMode);
                  setPreview(null);
                  setError(null);
                }}
              >
                <option value="guided">Guided filters</option>
                <option value="manual">Manual SOQL</option>
              </Select>
            </div>

            {accountQueryMode === 'guided' ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Each row builds a SOQL query by account group, bottler, and distribution channel.
                  ZFSV + bottler 5000 is blocked.
                </p>
                <div className="space-y-3">
                  {accountRows.map((row, index) => (
                    <div
                      key={index}
                      className={`grid gap-2 md:grid-cols-6 items-end p-3 rounded-lg border ${
                        isZfsv5000Blocked(row)
                          ? 'border-destructive/50 bg-destructive/5'
                          : 'border-border'
                      }`}
                    >
                      <div>
                        <Label htmlFor={`cona-seed-${index}-group`}>Group</Label>
                        <Select
                          id={`cona-seed-${index}-group`}
                          value={row.accountGroup}
                          onChange={(e) =>
                            updateRow(index, { accountGroup: e.target.value as AccountGroup })
                          }
                        >
                          <option value="Z001">Z001</option>
                          <option value="ZFSV">ZFSV</option>
                          <option value="Z003">Z003</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`cona-seed-${index}-bottler`}>Bottler</Label>
                        <Select
                          id={`cona-seed-${index}-bottler`}
                          value={row.bottler}
                          onChange={(e) =>
                            updateRow(index, { bottler: e.target.value as Bottler })
                          }
                        >
                          <option value="5000">5000</option>
                          <option value="4900">4900</option>
                          <option value="4600">4600</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`cona-seed-${index}-channel`}>Channel</Label>
                        <Select
                          id={`cona-seed-${index}-channel`}
                          value={row.distributionChannel}
                          onChange={(e) =>
                            updateRow(index, {
                              distributionChannel: e.target.value as DistributionChannel,
                            })
                          }
                        >
                          <option value="Z1">Z1</option>
                          <option value="Z3">Z3</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`cona-seed-${index}-limit`}>Limit</Label>
                        <Input
                          id={`cona-seed-${index}-limit`}
                          type="number"
                          min={1}
                          max={100_000}
                          value={row.limit}
                          onChange={(e) =>
                            updateRow(index, {
                              limit: Math.min(100_000, Math.max(1, Number(e.target.value) || 1)),
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2 flex gap-2">
                        {accountRows.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAccountRows((rows) => rows.filter((_, i) => i !== index));
                              setPreview(null);
                            }}
                            aria-label={`Remove account seed row ${index + 1}`}
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
                  onClick={() => {
                    setAccountRows((rows) => [...rows, { ...DEFAULT_ACCOUNT_ROW }]);
                    setPreview(null);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add account row
                </Button>
              </>
            ) : (
              <>
                <InlineAlert variant="info" title="Manual Account SOQL">
                  Queries must select Account records and include{' '}
                  <code>AccountNumber</code> plus at least one field to seed.
                  Relationship subqueries and aggregate expressions are not supported. The maximum
                  records value replaces any LIMIT in the query.
                </InlineAlert>
                <div className="space-y-3 mt-3">
                  {manualQueries.map((query, index) => (
                    <div key={query.id} className="rounded-lg border border-border p-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto] items-end">
                        <div>
                          <Label htmlFor={`cona-manual-${query.id}-label`}>Query label</Label>
                          <Input
                            id={`cona-manual-${query.id}-label`}
                            value={query.label}
                            maxLength={120}
                            onChange={(event) =>
                              updateManualQuery(index, { label: event.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`cona-manual-${query.id}-limit`}>Maximum records</Label>
                          <Input
                            id={`cona-manual-${query.id}-limit`}
                            type="number"
                            min={1}
                            max={100_000}
                            value={query.limit}
                            onChange={(event) =>
                              updateManualQuery(index, {
                                limit: Math.min(
                                  100_000,
                                  Math.max(1, Number(event.target.value) || 1),
                                ),
                              })
                            }
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Upper bound; matched records may be lower.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={manualQueries.length === 1}
                          onClick={() => {
                            setManualQueries((queries) =>
                              queries.filter((_, queryIndex) => queryIndex !== index));
                            setPreview(null);
                          }}
                          aria-label={`Remove manual query ${index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div>
                        <Label htmlFor={`cona-manual-${query.id}-soql`}>SOQL query</Label>
                        <Textarea
                          id={`cona-manual-${query.id}-soql`}
                          value={query.soql}
                          className="min-h-36 font-mono text-xs"
                          placeholder={
                            'SELECT Name, AccountNumber, '
                            + 'cfs_ob__Bottler__c FROM Account WHERE ...'
                          }
                          onChange={(event) =>
                            updateManualQuery(index, { soql: event.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1"
                  onClick={addManualQuery}
                >
                  <Code2 className="w-4 h-4" />
                  Add manual query
                </Button>
              </>
            )}
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
            disabled={!sourceOrgId || !targetOrgId || sourceOrgId === targetOrgId || isRunning}
            loading={loadingAction === 'preview'}
          >
            Preview / validate
          </Button>
          <Button
            onClick={() => void handleRun()}
            disabled={!sourceOrgId || !targetOrgId || sourceOrgId === targetOrgId || isRunning}
            loading={loadingAction === 'run'}
          >
            Run CONA seed
          </Button>
        </div>

        {preview && (
          <div className="mt-4 space-y-3">
            <InlineAlert variant={preview.ok ? 'success' : 'warning'} title="Validation">
              {preview.ok
                ? 'Validation passed. Matching source records are ready to seed.'
                : 'Some checks failed — review counts below.'}
            </InlineAlert>
            {preview.checks && (
              <ul className="text-xs space-y-1 font-mono">
                {preview.checks.map((c) => (
                  <li key={c.dataset} className={c.ok ? 'text-muted-foreground' : 'text-amber-600'}>
                    {c.dataset}:{' '}
                    {c.requestedMaximum != null
                      ? `${c.count.toLocaleString()} selected · ${(c.availableCount ?? c.count).toLocaleString()} matched · ${c.requestedMaximum.toLocaleString()} maximum`
                      : c.count.toLocaleString()}{' '}
                    {c.ok ? '✓' : '✗'}
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
            {preview.manualOnboardingQueries?.map((query) => (
              <details key={query.id} className="text-xs" open>
                <summary className="cursor-pointer text-muted-foreground">
                  {query.label}: {query.selectedCount.toLocaleString()} selected ·{' '}
                  {query.availableCount.toLocaleString()} matched ·{' '}
                  {query.limit.toLocaleString()} maximum
                </summary>
                {(query.expandedCompoundFields.length > 0
                  || query.excludedFields.length > 0) && (
                  <div className="mt-2 space-y-1 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-amber-700 dark:text-amber-300">
                    {query.expandedCompoundFields.map((field) => (
                      <p key={field.field}>
                        Expanded <code>{field.field}</code> →{' '}
                        <code>{field.components.join(', ')}</code>
                      </p>
                    ))}
                    {query.excludedFields.map((field, index) => (
                      <p key={`${field.field}-${index}`}>
                        Excluded <code>{field.field}</code>: {field.reason}
                      </p>
                    ))}
                  </div>
                )}
                <pre className="studio-console p-2 mt-1 rounded overflow-x-auto whitespace-pre-wrap">
                  {query.soql}
                </pre>
              </details>
            ))}
            {preview.manualQueries?.map((query) => (
              <details key={query.id} className="text-xs" open>
                <summary className="cursor-pointer text-muted-foreground">
                  {query.label}: {query.selectedCount.toLocaleString()} selected ·{' '}
                  {query.availableCount.toLocaleString()} matched ·{' '}
                  {query.limit.toLocaleString()} maximum
                </summary>
                <pre className="studio-console p-2 mt-1 rounded overflow-x-auto whitespace-pre-wrap">
                  {query.soql}
                </pre>
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
        description="Validate, export, and import onboarding data with guided Account filters or manual SOQL."
      >
        {formContent}
      </GlassCard>
      {jobProgress}
    </div>
  );
}
