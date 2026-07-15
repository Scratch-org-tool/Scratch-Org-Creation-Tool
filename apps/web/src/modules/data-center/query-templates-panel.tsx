'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import {
  DATA_CENTER_ADD_QUERY_EVENT,
  normalizeTemplates,
  templateToQuery,
  type QueryTemplateApi,
} from './data-center-contracts';

export function QueryTemplatesPanel() {
  const [templates, setTemplates] = useState<QueryTemplateApi[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    api<unknown>('/data/query-templates')
      .then((value) => setTemplates(normalizeTemplates(value)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load templates'));
  }, []);

  const resolveQuery = (template: QueryTemplateApi) =>
    templateToQuery(template, variables[template.id] ?? {});

  const copySoql = async (template: QueryTemplateApi) => {
    try {
      const query = resolveQuery(template);
      await navigator.clipboard.writeText(query.soql);
      const id = template.id;
      setCopiedId(id);
      setError(null);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not copy template');
    }
  };

  const addQuery = (template: QueryTemplateApi, target: 'replication' | 'deploy') => {
    try {
      const query = resolveQuery(template);
      window.dispatchEvent(new CustomEvent(DATA_CENTER_ADD_QUERY_EVENT, {
        detail: { target, query },
      }));
      setAdded(`${template.id}:${target}`);
      setError(null);
      setTimeout(() => setAdded(null), 2000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Template variables are incomplete');
    }
  };

  if (templates.length === 0) {
    return (
      <div>
        {error && <InlineAlert variant="error">{error}</InlineAlert>}
        {!error && <p className="text-sm text-muted-foreground">No query templates configured.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <InlineAlert variant="error" onDismiss={() => setError(null)}>{error}</InlineAlert>}
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <div key={template.id} className="rounded-lg border border-border/60 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium">{template.label}</p>
              <p className="text-xs text-muted-foreground">
                {template.object} · {template.operation}
                {template.externalIdField ? ` by ${template.externalIdField}` : ''}
              </p>
            </div>
            <pre className="studio-console p-3 rounded text-xs overflow-auto max-h-40">
              {template.soqlTemplate}
            </pre>
            {template.requiredVariables.map((variable) => (
              <div key={variable}>
                <Label htmlFor={`template-${template.id}-${variable}`}>{variable}</Label>
                <Input
                  id={`template-${template.id}-${variable}`}
                  value={variables[template.id]?.[variable] ?? ''}
                  onChange={(event) => setVariables((current) => ({
                    ...current,
                    [template.id]: {
                      ...current[template.id],
                      [variable]: event.target.value,
                    },
                  }))}
                />
              </div>
            ))}
            {template.dependsOn.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Depends on: {template.dependsOn.join(', ')}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void copySoql(template)}>
                {copiedId === template.id ? 'Copied!' : 'Copy SOQL'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => addQuery(template, 'deploy')}>
                {added === `${template.id}:deploy` ? 'Added' : 'Use in deploy'}
              </Button>
              <Button size="sm" onClick={() => addQuery(template, 'replication')}>
                {added === `${template.id}:replication` ? 'Added' : 'Add to query set'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
