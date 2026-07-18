'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import {
  DATA_CENTER_ADD_QUERY_EVENT,
  normalizeTemplates,
  templateToQuery,
  type QueryTemplateApi,
} from './data-center-contracts';

interface TemplateFormState {
  name: string;
  description: string;
  objectName: string;
  soqlTemplate: string;
  shared: boolean;
}

const EMPTY_TEMPLATE_FORM: TemplateFormState = {
  name: '',
  description: '',
  objectName: '',
  soqlTemplate: '',
  shared: false,
};

export function QueryTemplatesPanel() {
  const [templates, setTemplates] = useState<QueryTemplateApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<unknown>('/data/query-templates')
      .then((value) => setTemplates(normalizeTemplates(value)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load templates'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createTemplate = async () => {
    setSaving(true);
    setError(null);
    try {
      await api('/data/custom-templates', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          objectName: form.objectName.trim(),
          soqlTemplate: form.soqlTemplate.trim(),
          shared: form.shared,
        }),
      });
      setForm(EMPTY_TEMPLATE_FORM);
      setShowForm(false);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the template');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (template: QueryTemplateApi) => {
    setDeletingId(template.id);
    setError(null);
    try {
      await api(`/data/custom-templates/${encodeURIComponent(template.id)}`, { method: 'DELETE' });
      setTemplates((current) => current.filter((row) => row.id !== template.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the template');
    } finally {
      setDeletingId(null);
    }
  };

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

  const templateForm = showForm && (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="new-template-name">Template name</Label>
          <Input
            id="new-template-name"
            value={form.name}
            maxLength={120}
            onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
            placeholder="Active accounts by region"
          />
        </div>
        <div>
          <Label htmlFor="new-template-object">Object API name</Label>
          <Input
            id="new-template-object"
            value={form.objectName}
            maxLength={120}
            onChange={(event) => setForm((c) => ({ ...c, objectName: event.target.value }))}
            placeholder="Account"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="new-template-soql">SOQL template</Label>
        <Textarea
          id="new-template-soql"
          value={form.soqlTemplate}
          rows={4}
          onChange={(event) => setForm((c) => ({ ...c, soqlTemplate: event.target.value }))}
          placeholder={'SELECT Id, Name FROM Account WHERE Region__c = \'{{region}}\' LIMIT {{limit}}'}
          className="font-mono text-xs"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use {'{{variable}}'} placeholders — they become required inputs when the template is used.
        </p>
      </div>
      <div>
        <Label htmlFor="new-template-description">Description (optional)</Label>
        <Input
          id="new-template-description"
          value={form.description}
          maxLength={1000}
          onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={form.shared}
            onChange={(next) => setForm((c) => ({ ...c, shared: next }))}
            size="sm"
            aria-label="Share with everyone"
          />
          Share with everyone
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void createTemplate()}
            loading={saving}
            disabled={!form.name.trim() || !form.objectName.trim() || !form.soqlTemplate.trim()}
          >
            Save template
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy role="status" aria-label="Loading query templates">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border/60 p-4 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="space-y-4">
        {error && <InlineAlert variant="error" onDismiss={() => setError(null)}>{error}</InlineAlert>}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">No query templates configured.</p>
          <Button size="sm" variant="outline" onClick={() => setShowForm((current) => !current)}>
            <Plus aria-hidden />
            New template
          </Button>
        </div>
        {templateForm}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <InlineAlert variant="error" onDismiss={() => setError(null)}>{error}</InlineAlert>}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Built-in templates ship with the platform; your custom templates are stored per user and
          can be shared with the whole team.
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowForm((current) => !current)}>
          <Plus aria-hidden />
          New template
        </Button>
      </div>
      {templateForm}
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <div key={template.id} className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{template.label}</span>
                  {template.source === 'custom' && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      {template.shared ? 'shared' : 'mine'}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {template.object} · {template.operation}
                  {template.externalIdField ? ` by ${template.externalIdField}` : ''}
                  {template.description ? ` · ${template.description}` : ''}
                </p>
              </div>
              {template.source === 'custom' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void deleteTemplate(template)}
                  loading={deletingId === template.id}
                  disabled={Boolean(deletingId)}
                  aria-label={`Delete ${template.label}`}
                >
                  {deletingId !== template.id && <Trash2 aria-hidden />}
                </Button>
              )}
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
