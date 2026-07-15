'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import type { OrgToOrgFilterRow, OrgToOrgObjectMeta } from './types';
import { FILTER_OPERATORS } from './types';

interface OrgToOrgFilterBuilderProps {
  meta: OrgToOrgObjectMeta;
  filters: OrgToOrgFilterRow[];
  matchCount?: number;
  loading?: boolean;
  onChange: (filters: OrgToOrgFilterRow[]) => void;
}

const EMPTY_FILTER = (): OrgToOrgFilterRow => ({
  field: '',
  operator: 'eq',
  value: '',
});

export function OrgToOrgFilterBuilder({
  meta,
  filters,
  matchCount,
  loading,
  onChange,
}: OrgToOrgFilterBuilderProps) {
  const [fieldSearch, setFieldSearch] = useState('');

  const sortedFields = useMemo(
    () => [...meta.filterableFields].sort((a, b) => a.name.localeCompare(b.name)),
    [meta.filterableFields],
  );

  const visibleFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return sortedFields;
    return sortedFields.filter(
      (f) => f.name.toLowerCase().includes(q) || f.label.toLowerCase().includes(q),
    );
  }, [sortedFields, fieldSearch]);

  const updateRow = (index: number, patch: Partial<OrgToOrgFilterRow>) => {
    const next = filters.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const addRow = () => {
    const firstField = sortedFields[0]?.name ?? '';
    onChange([...filters, { ...EMPTY_FILTER(), field: firstField }]);
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium leading-none">Configure filters</p>
        <span className="text-xs text-muted-foreground">
          {loading ? 'Counting…' : `${matchCount ?? '—'} records match this filter`}
        </span>
      </div>

      {filters.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border/60 px-3 py-2.5">
          No filters — all records up to the limit will be included.
        </p>
      ) : (
        <>
          <Input
            aria-label="Search filter fields"
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            placeholder="Search fields by API name or label…"
            className="text-xs h-8"
          />

          <div className="space-y-2">
            {filters.map((row, index) => {
              const selectedField = meta.filterableFields.find((f) => f.name === row.field);
              const valueDisabled = row.operator === 'empty' || row.operator === 'not_empty';

              return (
                <div
                  key={index}
                  className="rounded-lg border border-border/50 bg-secondary/10 px-3 py-2.5 min-w-0"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] gap-x-3 gap-y-2 sm:items-start">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground sm:sr-only">
                        Field
                      </span>
                      <Select
                        aria-label={`Filter ${index + 1} field`}
                        value={row.field}
                        onChange={(e) => updateRow(index, { field: e.target.value })}
                        className="font-mono text-xs h-9"
                      >
                        <option value="">Select field…</option>
                        {visibleFields.map((f) => (
                          <option key={f.name} value={f.name} title={f.name}>
                            {f.name}
                          </option>
                        ))}
                      </Select>
                      {selectedField && selectedField.label !== selectedField.name && (
                        <p className="text-[10px] text-muted-foreground truncate mt-1">
                          {selectedField.label}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground sm:sr-only">
                        Operator
                      </span>
                      <Select
                        aria-label={`Filter ${index + 1} operator`}
                        value={row.operator}
                        onChange={(e) =>
                          updateRow(index, {
                            operator: e.target.value as OrgToOrgFilterRow['operator'],
                          })
                        }
                        className="text-xs h-9"
                      >
                        {FILTER_OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground sm:sr-only">
                        Value
                      </span>
                      <Input
                        aria-label={`Filter ${index + 1} value`}
                        value={row.value ?? ''}
                        disabled={valueDisabled}
                        onChange={(e) => updateRow(index, { value: e.target.value })}
                        placeholder={row.operator === 'in' ? 'a, b, c' : 'Value'}
                        className="text-xs h-9"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(index)}
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0 justify-self-end sm:justify-self-start"
                      aria-label={`Remove filter ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        + Add filter
      </Button>
    </div>
  );
}
