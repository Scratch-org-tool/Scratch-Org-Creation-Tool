'use client';

import { useState } from 'react';
import { Link2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import type { WorkItemSummary } from './types';

interface DefectSubissuesPanelProps {
  items: WorkItemSummary[];
  writable: boolean;
  mutating: boolean;
  error?: string;
  onSelect: (id: string) => void;
  onAdd: (id: string) => Promise<void>;
}

export function DefectSubissuesPanel({
  items,
  writable,
  mutating,
  error,
  onSelect,
  onAdd,
}: DefectSubissuesPanelProps) {
  const [id, setId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id.trim()) return;
    setActionError(null);
    try {
      await onAdd(id.trim());
      setId('');
    } catch (addError) {
      setActionError(addError instanceof Error ? addError.message : 'Unable to add subissue');
    }
  };

  return (
    <div className="pt-2 border-t border-border/40 space-y-2">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">Subissues ({items.length})</p>
      </div>
      {(error || actionError) && <InlineAlert variant="warning">{actionError ?? error}</InlineAlert>}
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="w-full rounded-md border border-border/50 px-3 py-2 text-left text-sm hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">{item.id}</span>
                <span className="text-muted-foreground"> · {item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : !error ? (
        <p className="text-sm text-muted-foreground">No subissues.</p>
      ) : null}
      {writable && (
        <form onSubmit={(event) => void submit(event)} className="flex gap-2">
          <Input
            value={id}
            onChange={(event) => setId(event.target.value)}
            placeholder="Opaque work-item ID"
            aria-label="Subissue work-item ID"
            disabled={mutating}
          />
          <Button type="submit" variant="outline" size="sm" loading={mutating} disabled={!id.trim()}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add
          </Button>
        </form>
      )}
    </div>
  );
}
