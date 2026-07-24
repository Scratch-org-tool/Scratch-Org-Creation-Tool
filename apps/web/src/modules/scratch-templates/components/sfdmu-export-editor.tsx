'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import { FileDropzone } from './file-dropzone';
import {
  addFieldToSoql,
  objectLabel,
  parseSfdmuExportJson,
  removeObject,
  serializeSfdmuExportJson,
  updateObjectQuery,
  type SfdmuObjectEntry,
} from './sfdmu-soql-utils';

export type SfdmuExportMode = 'bundled' | 'master' | 'custom';

interface SfdmuExportEditorProps {
  mode: SfdmuExportMode;
  enabled: boolean;
  json: string;
  allowMasterMode?: boolean;
  onModeChange: (mode: SfdmuExportMode) => void;
  onEnabledChange: (enabled: boolean) => void;
  onJsonChange: (json: string) => void;
}

function templatePath(mode: SfdmuExportMode): string {
  return mode === 'master'
    ? '/data/custom-settings/template?bundle=master'
    : '/data/custom-settings/template';
}

export function SfdmuExportEditor({
  mode,
  enabled,
  json,
  allowMasterMode = false,
  onModeChange,
  onEnabledChange,
  onJsonChange,
}: SfdmuExportEditorProps) {
  const [validation, setValidation] = useState<{
    objectCount: number;
    warnings: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [newFieldByIndex, setNewFieldByIndex] = useState<Record<number, string>>({});

  const objects = useMemo(() => {
    if (mode === 'custom' && json.trim()) {
      try {
        return parseSfdmuExportJson(json);
      } catch {
        return [];
      }
    }
    return [];
  }, [json, mode]);

  useEffect(() => {
    if (!enabled || mode === 'custom') return;
    let cancelled = false;
    void (async () => {
      try {
        const payload = await api<{ objects: SfdmuObjectEntry[] }>(templatePath(mode));
        if (!cancelled) onJsonChange(JSON.stringify(payload, null, 2));
      } catch {
        // keep existing preview text
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, mode, onJsonChange]);

  const validate = async (body?: unknown) => {
    setValidating(true);
    setError(null);
    try {
      const payload =
        body ??
        (mode === 'custom'
          ? JSON.parse(json)
          : await api(templatePath(mode)));
      const res = await api<{ objectCount: number; warnings: string[]; normalized: unknown }>(
        '/data/custom-settings/validate',
        { method: 'POST', body: JSON.stringify(payload) },
      );
      setValidation({ objectCount: res.objectCount, warnings: res.warnings });
      if (res.normalized && mode === 'custom') {
        onJsonChange(JSON.stringify(res.normalized, null, 2));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed');
      setValidation(null);
    } finally {
      setValidating(false);
    }
  };

  const onJsonFile = async (file: File | null) => {
    setJsonFile(file);
    if (!file) return;
    try {
      const text = await file.text();
      onJsonChange(text);
      onModeChange('custom');
      const parsed = JSON.parse(text) as unknown;
      await validate(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON file');
    }
  };

  const applyObjectEdits = (nextObjects: SfdmuObjectEntry[]) => {
    onModeChange('custom');
    onJsonChange(serializeSfdmuExportJson(nextObjects));
  };

  const addField = (index: number) => {
    const fieldName = newFieldByIndex[index]?.trim();
    if (!fieldName || !objects[index]) return;
    const nextQuery = addFieldToSoql(objects[index].query, fieldName);
    applyObjectEdits(updateObjectQuery(objects, index, nextQuery));
    setNewFieldByIndex((current) => ({ ...current, [index]: '' }));
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        {allowMasterMode ? 'Load master SFDMU export during pipeline' : 'Load custom settings during pipeline'}
      </label>

      {enabled && (
        <>
          <div className="flex flex-wrap gap-4">
            {allowMasterMode && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === 'master'}
                  onChange={() => onModeChange('master')}
                />
                Master bundled export
              </label>
            )}
            {!allowMasterMode && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === 'bundled'}
                  onChange={() => onModeChange('bundled')}
                />
                Bundled CONA export
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === 'custom'}
                onChange={() => onModeChange('custom')}
              />
              Custom JSON
            </label>
          </div>

          <div className="space-y-3">
            <FileDropzone
              accept=".json"
              label="Drop SFDMU export JSON"
              hint="Import replaces the current export and switches to custom mode"
              file={jsonFile}
              onFileChange={(f) => void onJsonFile(f)}
            />

            {mode !== 'custom' && (
              <p className="text-xs text-muted-foreground">
                Using the {mode === 'master' ? 'master' : 'bundled'} export from the repository.
                Import or edit objects below to customize.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void validate()} loading={validating}>
                Validate export
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRawJson((value) => !value)}
              >
                {showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
              </Button>
              {mode !== 'custom' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onModeChange('custom');
                    if (!json.trim()) {
                      void api<{ objects: SfdmuObjectEntry[] }>(templatePath(mode))
                        .then((payload) => onJsonChange(JSON.stringify(payload, null, 2)))
                        .catch(() => undefined);
                    }
                  }}
                >
                  Edit as custom JSON
                </Button>
              )}
            </div>

            {validation && (
              <p className="text-xs text-muted-foreground">
                {validation.objectCount} objects
                {validation.warnings.length > 0 && ` · ${validation.warnings.length} warnings`}
              </p>
            )}
            {error && <InlineAlert variant="error">{error}</InlineAlert>}

            {(mode === 'custom' || objects.length > 0) && !showRawJson && (
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-sm font-medium">Objects ({objects.length})</p>
                {objects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Import or validate JSON to edit objects.</p>
                ) : (
                  objects.map((entry, index) => {
                    const open = expandedIndex === index;
                    return (
                      <div key={`${objectLabel(entry, index)}-${index}`} className="rounded border border-border/50">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
                          onClick={() => setExpandedIndex(open ? null : index)}
                        >
                          <span className="font-medium">{objectLabel(entry, index)}</span>
                          <span className="text-xs text-muted-foreground">{entry.operation}</span>
                        </button>
                        {open && (
                          <div className="space-y-3 border-t border-border/50 p-3">
                            <Textarea
                              className="font-mono text-xs min-h-[120px]"
                              value={entry.query}
                              onChange={(e) =>
                                applyObjectEdits(updateObjectQuery(objects, index, e.target.value))
                              }
                            />
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="min-w-[220px] flex-1">
                                <label className="mb-1 block text-xs text-muted-foreground">
                                  Add field to SELECT
                                </label>
                                <Input
                                  value={newFieldByIndex[index] ?? ''}
                                  onChange={(e) =>
                                    setNewFieldByIndex((current) => ({
                                      ...current,
                                      [index]: e.target.value,
                                    }))
                                  }
                                  placeholder="cfs_ob__New_Field__c"
                                />
                              </div>
                              <Button size="sm" variant="outline" onClick={() => addField(index)}>
                                Add field
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => applyObjectEdits(removeObject(objects, index))}
                              >
                                Remove object
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {(mode === 'custom' || showRawJson) && (
              <Textarea
                className="font-mono text-xs min-h-[180px]"
                value={json}
                onChange={(e) => {
                  onModeChange('custom');
                  onJsonChange(e.target.value);
                }}
                placeholder='{ "objects": [ { "query": "SELECT ...", "operation": "Upsert" } ] }'
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
