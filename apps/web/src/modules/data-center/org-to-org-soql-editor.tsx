'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import {
  OrgToOrgSoqlParseError,
  parseOrgToOrgSoql,
  validateSoqlForObject,
} from '@sfcc/shared';
import type { OrgToOrgObjectDeployConfig, OrgToOrgQueryMode } from './types';

interface OrgToOrgSoqlEditorProps {
  objectName: string;
  config: OrgToOrgObjectDeployConfig;
  onApply: (soql: string) => void;
  onModeChange: (mode: OrgToOrgQueryMode) => void;
  onClear: () => void;
}

export function OrgToOrgSoqlEditor({
  objectName,
  config,
  onApply,
  onModeChange,
  onClear,
}: OrgToOrgSoqlEditorProps) {
  const [draft, setDraft] = useState(config.customSoql ?? '');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    fields: string[];
    whereClause?: string;
    filterCount: number;
  } | null>(null);

  useEffect(() => {
    setDraft(config.customSoql ?? '');
    setParseError(null);
    if (!config.customSoql) setParsedPreview(null);
  }, [config.customSoql, objectName]);

  const mode = config.queryMode ?? 'builder';
  const isSoqlMode = mode === 'soql';

  const handleApply = () => {
    setParseError(null);
    setParsedPreview(null);
    try {
      validateSoqlForObject(draft, objectName);
      const parsed = parseOrgToOrgSoql(draft);
      setParsedPreview({
        fields: parsed.fields,
        whereClause: parsed.whereClause,
        filterCount: parsed.filters.length,
      });
      onApply(draft.trim());
    } catch (err) {
      const message =
        err instanceof OrgToOrgSoqlParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Invalid SOQL query';
      setParseError(message);
    }
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium leading-none">Record selection</p>
        <div className="flex rounded-md border border-border/60 overflow-hidden text-xs">
          <button
            type="button"
            className={`px-3 py-1.5 transition-colors ${
              !isSoqlMode ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary/40'
            }`}
            onClick={() => onModeChange('builder')}
          >
            Visual filters
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 transition-colors border-l border-border/60 ${
              isSoqlMode ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary/40'
            }`}
            onClick={() => onModeChange('soql')}
          >
            Custom SOQL
          </button>
        </div>
      </div>

      {isSoqlMode && (
        <>
          <Textarea
            aria-label={`Custom SOQL query for ${objectName}`}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setParseError(null);
            }}
            placeholder={`SELECT Id, Name FROM ${objectName} WHERE ...`}
            className="font-mono text-xs min-h-[120px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleApply}>
              Apply query
            </Button>
            {config.customSoql && (
              <Button type="button" size="sm" variant="outline" onClick={onClear}>
                Clear
              </Button>
            )}
          </div>
          {parseError && (
            <p className="text-xs text-red-500 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
              {parseError}
            </p>
          )}
          {parsedPreview && (
            <div className="text-xs rounded-md border border-border/60 bg-secondary/20 px-3 py-2 space-y-1">
              <p>
                <span className="text-muted-foreground">Fields:</span>{' '}
                <span className="font-mono">{parsedPreview.fields.join(', ')}</span>
              </p>
              {parsedPreview.whereClause && (
                <p>
                  <span className="text-muted-foreground">WHERE:</span>{' '}
                  <span className="font-mono">{parsedPreview.whereClause}</span>
                </p>
              )}
              <p className="text-muted-foreground">
                {parsedPreview.filterCount} filter condition(s) synced to visual builder
              </p>
            </div>
          )}
          {config.customSoql && !parsedPreview && (
            <p className="text-xs text-muted-foreground">
              Active custom query — preview and deploy use this SOQL.
            </p>
          )}
        </>
      )}
    </div>
  );
}
