'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, Plus, Trash2 } from 'lucide-react';
import {
  compileQuerySectionPlan,
  defaultExternalIdField,
  querySectionSchema,
  type AccountPartnerPlan,
  type QueryCategory,
  type QuerySection,
  type QuerySectionQuery,
} from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import {
  canMoveQuery,
  generatedStableQueryId,
  inferQueryCategory,
  inferQueryObject,
  queryReferenceLabels,
  reorderQueries,
} from './query-section-editor-utils';

const CATEGORIES: Array<{ value: QueryCategory; label: string }> = [
  { value: 'account', label: 'Account' },
  { value: 'employee_master', label: 'Employee master' },
  { value: 'account_partner', label: 'Account partner mapping' },
  { value: 'onboarding_config', label: 'Onboarding config' },
  { value: 'product', label: 'Product' },
  { value: 'visit_plan', label: 'Visit plan' },
  { value: 'arbitrary', label: 'Other / arbitrary' },
];

function defaultQuery(index: number, ids: readonly string[]): QuerySectionQuery {
  const name = `Query ${index + 1}`;
  return {
    id: generatedStableQueryId(name, ids),
    name,
    enabled: true,
    order: index,
    stage: index,
    category: 'arbitrary',
    object: 'Account',
    soql: 'SELECT Id, Name FROM Account',
    limit: 200,
    operation: 'upsert',
    externalIdField: 'Name',
    variables: {},
    dependsOn: [],
  };
}

function variablesText(variables: Record<string, string>): string {
  return Object.entries(variables).map(([key, value]) => `${key}=${value}`).join('\n');
}

function parseVariables(value: string): Record<string, string> {
  return Object.fromEntries(
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=');
        return separator < 0 ? [line, ''] : [line.slice(0, separator).trim(), line.slice(separator + 1)];
      }),
  );
}

function AccountPartnerPlanEditor({
  plan,
  queries,
  onChange,
}: {
  plan?: AccountPartnerPlan;
  queries: QuerySectionQuery[];
  onChange: (plan: AccountPartnerPlan | undefined) => void;
}) {
  const enabled = Boolean(plan);
  const initial = {
    accountQueryId: queries.find((query) => query.category === 'account')?.id ?? '',
    employeeMasterQueryId: queries.find((query) => query.category === 'employee_master')?.id ?? '',
    accountPartnerQueryId: queries.find((query) => query.category === 'account_partner')?.id ?? '',
    accountKeyField: 'AccountNumber',
    employeeKeyField: 'cfs_ob__EmployeeNo__c',
    mappingAccountKeyField: 'cfs_ob__Account__r.AccountNumber',
    mappingEmployeeKeyField: 'cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c',
    mappingRoleField: 'cfs_ob__PartnerRole__c',
    externalIdField: 'cfs_ob__AccountPartnerExternalId__c',
    externalIdPattern: '{{account}}-{{employee}}-{{role}}',
  } as AccountPartnerPlan;
  const update = (patch: Partial<AccountPartnerPlan>) => onChange({ ...(plan ?? initial), ...patch });
  const querySelect = (
    id: keyof Pick<AccountPartnerPlan, 'accountQueryId' | 'employeeMasterQueryId' | 'accountPartnerQueryId' | 'roleQueryId'>,
    label: string,
    category?: QueryCategory,
  ) => (
    <div>
      <Label htmlFor={`partner-plan-${id}`}>{label}</Label>
      <Select
        id={`partner-plan-${id}`}
        value={plan?.[id] ?? ''}
        onChange={(event) => update({ [id]: event.target.value || undefined })}
      >
        <option value="">Select query…</option>
        {queries.filter((query) => query.enabled && (!category || query.category === category)).map((query) => (
          <option key={query.id} value={query.id}>{query.name} ({query.id})</option>
        ))}
      </Select>
    </div>
  );

  return (
    <section className="rounded-lg border border-border/60 p-4 space-y-4" aria-labelledby="account-partner-plan-title">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked ? initial : undefined)}
        />
        <span>
          <span id="account-partner-plan-title" className="block text-sm font-medium">Account Partner Plan</span>
          <span className="block text-xs text-muted-foreground">Join account, employee, and mapping query results using explicit keys.</span>
        </span>
      </label>
      {plan && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {querySelect('accountQueryId', 'Account query', 'account')}
            {querySelect('employeeMasterQueryId', 'Employee query', 'employee_master')}
            {querySelect('accountPartnerQueryId', 'Mapping query', 'account_partner')}
            {querySelect('roleQueryId', 'Role lookup query (optional)', 'arbitrary')}
          </div>
          <p className="text-xs text-muted-foreground">
            When selected, the runtime requires this query to select its external ID field and
            uses those values to validate the mapping role field before partner rows are loaded.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ['accountKeyField', 'Account key field'],
              ['employeeKeyField', 'Employee key field'],
              ['mappingAccountKeyField', 'Mapping account key'],
              ['mappingEmployeeKeyField', 'Mapping employee key'],
              ['mappingRoleField', 'Mapping role field'],
              ['externalIdField', 'Target external ID field'],
              ['externalIdPattern', 'External ID pattern'],
            ] as const).map(([field, label]) => (
              <div key={field} className={field === 'externalIdPattern' ? 'sm:col-span-2' : undefined}>
                <Label htmlFor={`partner-plan-${field}`}>{label}</Label>
                <Input
                  id={`partner-plan-${field}`}
                  value={plan[field] ?? ''}
                  onChange={(event) => update({ [field]: event.target.value })}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function QuerySectionEditor({
  value,
  sourceOrgId,
  salesOfficesByBottler,
  legacySummary,
  onChange,
}: {
  value?: QuerySection;
  sourceOrgId?: string;
  salesOfficesByBottler?: Record<string, string[]>;
  legacySummary?: string;
  onChange: (value: QuerySection | undefined) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(value?.queries[0]?.id ?? null);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, Array<{
    id: string;
    name: string;
    totalSize: number;
    records: unknown[];
  }>>>({});
  const queries = useMemo(
    () => [...(value?.queries ?? [])].sort(
      (left, right) => left.stage - right.stage || left.order - right.order,
    ),
    [value?.queries],
  );

  const validation = useMemo(() => {
    if (!value) return null;
    try {
      const parsed = querySectionSchema.parse(value);
      const compiled = compileQuerySectionPlan(parsed);
      return { valid: true as const, count: compiled.queries.length };
    } catch (error) {
      return { valid: false as const, error: error instanceof Error ? error.message : 'Invalid query section' };
    }
  }, [value]);

  const setQueries = (next: QuerySectionQuery[]) => {
    onChange({
      name: value?.name || 'Data deployment queries',
      queries: next.map((query, order) => ({ ...query, order })),
      accountPartnerPlan: value?.accountPartnerPlan,
    });
  };

  const update = (index: number, patch: Partial<QuerySectionQuery>) => {
    setQueries(queries.map((query, queryIndex) => queryIndex === index ? { ...query, ...patch } : query));
  };

  const move = (index: number, direction: -1 | 1) => {
    if (!canMoveQuery(queries, index, direction)) {
      setMessage({ kind: 'error', text: 'This move would put a dependency after the query that needs it.' });
      return;
    }
    setQueries(reorderQueries(queries, index, direction));
    setMessage(null);
  };

  const preview = async (query: QuerySectionQuery) => {
    if (!sourceOrgId) {
      setMessage({ kind: 'error', text: 'Select a Data Deployment Org before previewing queries.' });
      return;
    }
    setPreviewingId(query.id);
    setMessage(null);
    try {
      const result = await api<{
        queries: Array<{
          id: string;
          name: string;
          totalSize: number;
          records: unknown[];
        }>;
      }>('/data/query-section/preview', {
        method: 'POST',
        body: JSON.stringify({
          sourceOrgId,
          section: {
            name: value?.name || 'Preview',
            queries: [{ ...query, dependsOn: [] }],
          },
          salesOfficesByBottler,
        }),
      });
      setPreviews((current) => ({
        ...current,
        [query.id]: result.queries,
      }));
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Preview failed' });
    } finally {
      setPreviewingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {legacySummary && (
        <InlineAlert variant="info" title="Legacy configuration imported">
          {legacySummary} The original query JSON/account rows remain stored for old edit paths.
        </InlineAlert>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[240px] flex-1">
          <Label htmlFor="query-section-name">Query section name</Label>
          <Input
            id="query-section-name"
            value={value?.name ?? ''}
            placeholder="Data deployment queries"
            onChange={(event) => onChange({
              name: event.target.value,
              queries,
              accountPartnerPlan: value?.accountPartnerPlan,
            })}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const query = defaultQuery(queries.length, queries.map((item) => item.id));
            setQueries([...queries, query]);
            setExpandedId(query.id);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Add query
        </Button>
      </div>

      {queries.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No V2 queries configured. Add a query or keep using the legacy Data seed settings.
        </div>
      )}

      <div className="space-y-3" role="list" aria-label="Ordered deployment queries">
        <p className="text-xs text-muted-foreground">
          Rows are the preferred execution sequence. Moving a row renumbers stage and order
          together; declared dependencies always run first.
        </p>
        {queries.map((query, index) => {
          const inferredObject = inferQueryObject(query.soql);
          const previewResult = previews[query.id];
          const references = queryReferenceLabels(query.id, queries, value?.accountPartnerPlan);
          return (
            <article key={query.id} role="listitem" className="rounded-lg border border-border/60 bg-card/30">
              <div className="flex flex-wrap items-center gap-2 p-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setExpandedId(expandedId === query.id ? null : query.id)}
                  aria-expanded={expandedId === query.id}
                >
                  <span className="font-medium text-sm">{index + 1}. {query.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {query.id} · stage {query.stage} · {query.object} · limit {query.limit}
                  </span>
                </button>
                <label className="inline-flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={query.enabled}
                    disabled={query.enabled && references.length > 0}
                    title={references.length ? `Required as ${references.join(', ')}` : undefined}
                    onChange={(event) => update(index, { enabled: event.target.checked })}
                  />
                  Enabled
                </label>
                <Button type="button" size="sm" variant="ghost" aria-label={`Move ${query.name} up`} disabled={!canMoveQuery(queries, index, -1)} onClick={() => move(index, -1)}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" aria-label={`Move ${query.name} down`} disabled={!canMoveQuery(queries, index, 1)} onClick={() => move(index, 1)}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Duplicate ${query.name}`}
                  onClick={() => {
                    const copy = {
                      ...query,
                      id: generatedStableQueryId(`${query.id}-copy`, queries.map((item) => item.id)),
                      name: `${query.name} copy`,
                      dependsOn: [...query.dependsOn],
                    };
                    setQueries([...queries.slice(0, index + 1), copy, ...queries.slice(index + 1)]);
                    setExpandedId(copy.id);
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${query.name}`}
                  disabled={references.length > 0}
                  title={references.length ? `Required as ${references.join(', ')}` : undefined}
                  onClick={() => setQueries(queries.filter((_, queryIndex) => queryIndex !== index))}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              {expandedId === query.id && (
                <div className="border-t border-border/60 p-4 space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <Label htmlFor={`query-${query.id}-name`}>Name</Label>
                      <Input id={`query-${query.id}-name`} value={query.name} onChange={(event) => update(index, { name: event.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor={`query-${query.id}-id`}>Stable ID</Label>
                      <Input id={`query-${query.id}-id`} value={query.id} readOnly aria-readonly="true" />
                      <p className="text-xs text-muted-foreground mt-1">Immutable after creation so references remain valid.</p>
                    </div>
                    <div>
                      <Label htmlFor={`query-${query.id}-stage`}>Stage</Label>
                      <Input id={`query-${query.id}-stage`} type="number" value={query.stage} readOnly aria-readonly="true" />
                    </div>
                    <div>
                      <Label htmlFor={`query-${query.id}-object`}>Salesforce object</Label>
                      <Input id={`query-${query.id}-object`} value={query.object} onChange={(event) => update(index, { object: event.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor={`query-${query.id}-category`}>Category</Label>
                      <Select id={`query-${query.id}-category`} value={query.category} onChange={(event) => update(index, { category: event.target.value as QueryCategory })}>
                        {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`query-${query.id}-operation`}>Operation</Label>
                      <Select id={`query-${query.id}-operation`} value={query.operation} onChange={(event) => update(index, { operation: event.target.value as QuerySectionQuery['operation'] })}>
                        <option value="upsert">Upsert</option>
                        <option value="insert">Insert</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`query-${query.id}-limit`}>Mandatory record limit</Label>
                      <Input id={`query-${query.id}-limit`} type="number" min={1} required value={query.limit} onChange={(event) => update(index, { limit: Number(event.target.value) })} />
                    </div>
                    <div>
                      <Label htmlFor={`query-${query.id}-bottler`}>Bottler (optional)</Label>
                      <Input id={`query-${query.id}-bottler`} value={query.bottler ?? ''} onChange={(event) => update(index, { bottler: event.target.value || undefined })} />
                    </div>
                    <div>
                      <Label htmlFor={`query-${query.id}-external-id`}>External ID field</Label>
                      <Input id={`query-${query.id}-external-id`} value={query.externalIdField ?? ''} onChange={(event) => update(index, { externalIdField: event.target.value || undefined })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`query-${query.id}-depends`}>Depends on</Label>
                      <Select
                        id={`query-${query.id}-depends`}
                        multiple
                        className="min-h-24"
                        value={query.dependsOn}
                        onChange={(event) => update(index, { dependsOn: Array.from(event.target.selectedOptions, (option) => option.value) })}
                      >
                        {queries.filter((candidate) => candidate.id !== query.id).map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.id})</option>
                        ))}
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Use Ctrl/Cmd to select multiple dependencies.</p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`query-${query.id}-soql`}>SOQL</Label>
                    <Textarea
                      id={`query-${query.id}-soql`}
                      className="min-h-40 font-mono text-xs"
                      spellCheck={false}
                      value={query.soql}
                      onChange={(event) => update(index, { soql: event.target.value })}
                      onBlur={() => {
                        const object = inferQueryObject(query.soql);
                        if (!object) return;
                        const category = inferQueryCategory(object);
                        update(index, {
                          object,
                          category,
                          externalIdField: query.externalIdField ?? defaultExternalIdField(category, object),
                        });
                      }}
                    />
                    {inferredObject && inferredObject.toLowerCase() !== query.object.toLowerCase() && (
                      <p className="text-xs text-destructive mt-1">SOQL selects {inferredObject}, but the configured object is {query.object}.</p>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`query-${query.id}-variables`}>Variables (key=value, one per line)</Label>
                      <Textarea id={`query-${query.id}-variables`} value={variablesText(query.variables)} onChange={(event) => update(index, { variables: parseVariables(event.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={query.salesOfficeExpansion?.enabled ?? false}
                          onChange={(event) => update(index, {
                            salesOfficeExpansion: event.target.checked
                              ? { enabled: true, variable: 'salesOffice' }
                              : undefined,
                          })}
                        />
                        Expand once per sales office
                      </label>
                      {query.salesOfficeExpansion?.enabled && (
                        <>
                          <Input
                            aria-label="Sales office variable"
                            value={query.salesOfficeExpansion.variable}
                            onChange={(event) => update(index, { salesOfficeExpansion: { ...query.salesOfficeExpansion!, variable: event.target.value } })}
                          />
                          <Input
                            aria-label="Sales offices"
                            placeholder="1000, 2000"
                            value={query.salesOfficeExpansion.offices?.join(', ') ?? ''}
                            onChange={(event) => update(index, {
                              salesOfficeExpansion: {
                                ...query.salesOfficeExpansion!,
                                offices: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                              },
                            })}
                          />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" size="sm" variant="outline" loading={previewingId === query.id} onClick={() => void preview(query)}>
                      <Eye className="w-4 h-4 mr-1" /> Validate & preview
                    </Button>
                    {previewResult && (
                      <span className="text-xs text-muted-foreground">
                        {previewResult.length} variant{previewResult.length === 1 ? '' : 's'} ·{' '}
                        {previewResult.reduce((sum, result) => sum + result.totalSize, 0)} matching records
                      </span>
                    )}
                  </div>
                  {previewResult?.length ? (
                    <ul className="space-y-1 text-xs" aria-label={`${query.name} preview variants`}>
                      {previewResult.map((result) => (
                        <li key={result.id} className="rounded-md border border-border/50 p-2">
                          <span className="font-medium">{result.name}</span>
                          <span className="text-muted-foreground">
                            {' '}· {result.totalSize} matching · {result.records.length} previewed
                          </span>
                          {result.records.length > 0 && (
                            <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/30 p-2 text-[10px]">
                              {JSON.stringify(result.records, null, 2)}
                            </pre>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {value && (
        <AccountPartnerPlanEditor
          plan={value.accountPartnerPlan}
          queries={queries}
          onChange={(accountPartnerPlan) => onChange({ ...value, accountPartnerPlan })}
        />
      )}

      {message && <InlineAlert variant={message.kind === 'error' ? 'error' : 'success'}>{message.text}</InlineAlert>}
      {validation && (
        <InlineAlert variant={validation.valid ? 'success' : 'error'} title={validation.valid ? 'Query section valid' : 'Query section needs attention'}>
          {validation.valid
            ? `${queries.filter((query) => query.enabled).length} enabled queries resolve to ${validation.count} ordered execution item(s).`
            : validation.error}
        </InlineAlert>
      )}
    </div>
  );
}
