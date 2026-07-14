'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';

interface Template {
  id: string;
  name: string;
  soql: string;
}

export function QueryTemplatesPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    api<Template[]>('/data/templates').then(setTemplates).catch(console.error);
  }, []);

  const copySoql = async (id: string, soql: string) => {
    await navigator.clipboard.writeText(soql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">No query templates configured.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {templates.map((t) => (
        <div key={t.id} className="rounded-lg border border-border/60 p-4 space-y-3">
          <p className="text-sm font-medium">{t.name}</p>
          <pre className="studio-console p-3 rounded text-xs overflow-auto max-h-40">{t.soql}</pre>
          <Button size="sm" variant="outline" onClick={() => void copySoql(t.id, t.soql)}>
            {copiedId === t.id ? 'Copied!' : 'Copy SOQL'}
          </Button>
        </div>
      ))}
    </div>
  );
}
