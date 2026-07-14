'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { defaultDeployFieldSelection } from '@sfcc/shared';
import type { OrgToOrgDeployableField } from './types';

interface OrgToOrgDeployFieldsPickerProps {
  deployableFields: OrgToOrgDeployableField[];
  selectedFields: string[];
  matchField: string;
  onChange: (fields: string[]) => void;
}

export function OrgToOrgDeployFieldsPicker({
  deployableFields,
  selectedFields,
  matchField,
  onChange,
}: OrgToOrgDeployFieldsPickerProps) {
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selectedFields), [selectedFields]);

  const requiredFields = useMemo(
    () => deployableFields.filter((f) => f.required).map((f) => f.name),
    [deployableFields],
  );

  const missingRequired = requiredFields.filter((name) => !selectedSet.has(name));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deployableFields;
    return deployableFields.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.label.toLowerCase().includes(q),
    );
  }, [deployableFields, search]);

  const toggle = (name: string, checked: boolean) => {
    const next = new Set(selectedFields);
    if (checked) next.add(name);
    else next.delete(name);
    onChange(Array.from(next));
  };

  const selectAllRequired = () => {
    const next = new Set(selectedFields);
    for (const name of requiredFields) next.add(name);
    onChange(Array.from(next));
  };

  const selectAllDeployable = () => {
    onChange(deployableFields.filter((f) => f.createable).map((f) => f.name));
  };

  const resetDefaults = () => {
    onChange(defaultDeployFieldSelection(deployableFields, matchField));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Fields to deploy</Label>
        <span className="text-xs text-muted-foreground">
          {selectedFields.length} of {deployableFields.length} selected
        </span>
      </div>

      {missingRequired.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          Required fields not selected: {missingRequired.join(', ')}
        </p>
      )}

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search fields…"
        className="text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={selectAllRequired}>
          Select all required
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={selectAllDeployable}>
          Select all deployable
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={resetDefaults}>
          Reset to defaults
        </Button>
      </div>

      <div className="min-w-0 overflow-x-auto overflow-y-auto border border-border/60 rounded-lg max-h-52">
        <table className="text-xs w-max min-w-full">
          <thead className="sticky top-0 z-10 bg-card [&_th]:bg-card border-b border-border/60">
            <tr>
              <th className="w-10 px-2 py-1.5" />
              <th className="text-left px-2 py-1.5">Field</th>
              <th className="text-left px-2 py-1.5">Type</th>
              <th className="text-left px-2 py-1.5">Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-muted-foreground">
                  No fields match your search.
                </td>
              </tr>
            ) : (
              filtered.map((field) => (
                <tr key={field.name} className="border-t border-border/30">
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(field.name)}
                      onChange={(e) => toggle(field.name, e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="block font-medium">{field.label}</span>
                    <span className="block font-mono text-muted-foreground">{field.name}</span>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{field.type}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {field.required && (
                        <span className="rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5">
                          Required
                        </span>
                      )}
                      {field.reference && (
                        <span className="rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1.5 py-0.5">
                          Reference
                        </span>
                      )}
                      {field.custom && (
                        <span className="rounded bg-secondary px-1.5 py-0.5">Custom</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
