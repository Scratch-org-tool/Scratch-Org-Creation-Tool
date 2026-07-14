'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import { FileDropzone } from './file-dropzone';

interface SfdmuExportEditorProps {
  mode: 'bundled' | 'custom';
  enabled: boolean;
  json: string;
  onModeChange: (mode: 'bundled' | 'custom') => void;
  onEnabledChange: (enabled: boolean) => void;
  onJsonChange: (json: string) => void;
}

export function SfdmuExportEditor({
  mode,
  enabled,
  json,
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

  const validate = async (body?: unknown) => {
    setValidating(true);
    setError(null);
    try {
      const payload =
        body ??
        (mode === 'bundled' ? await api('/data/custom-settings/template') : JSON.parse(json));
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
      const parsed = JSON.parse(text) as unknown;
      await validate(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON file');
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Load custom settings during pipeline
      </label>

      {enabled && (
        <>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === 'bundled'}
                onChange={() => onModeChange('bundled')}
              />
              Bundled CONA export
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === 'custom'}
                onChange={() => onModeChange('custom')}
              />
              Custom JSON
            </label>
          </div>

          {mode === 'custom' && (
            <div className="space-y-3">
              <FileDropzone
                accept=".json"
                label="Drop SFDMU export JSON"
                hint="Or paste JSON below"
                file={jsonFile}
                onFileChange={(f) => void onJsonFile(f)}
              />
              <Textarea
                className="font-mono text-xs min-h-[180px]"
                value={json}
                onChange={(e) => onJsonChange(e.target.value)}
                placeholder='{ "objects": [ { "query": "SELECT ...", "operation": "Upsert" } ] }'
              />
            </div>
          )}

          <Button size="sm" variant="outline" onClick={() => void validate()} loading={validating}>
            Validate export
          </Button>

          {validation && (
            <p className="text-xs text-muted-foreground">
              {validation.objectCount} objects
              {validation.warnings.length > 0 && ` · ${validation.warnings.length} warnings`}
            </p>
          )}
          {error && <InlineAlert variant="error">{error}</InlineAlert>}
        </>
      )}
    </div>
  );
}
