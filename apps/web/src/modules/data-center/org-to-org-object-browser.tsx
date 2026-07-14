'use client';

import { useState } from 'react';
import { Input, Label } from '@/components/ui/input';
import { cn } from '@/utils/cn';
import type { OrgToOrgObjectInfo } from './types';

interface OrgToOrgObjectBrowserProps {
  sourceObjects: OrgToOrgObjectInfo[];
  targetObjects: OrgToOrgObjectInfo[];
  selectedObject: string | null;
  onSelectObject: (apiName: string) => void;
  loading?: boolean;
}

function ObjectList({
  title,
  subtitle,
  objects,
  selectedObject,
  onSelectObject,
  selectable,
  highlightSet,
}: {
  title: string;
  subtitle: string;
  objects: OrgToOrgObjectInfo[];
  selectedObject: string | null;
  onSelectObject?: (apiName: string) => void;
  selectable?: boolean;
  highlightSet?: Set<string>;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="mb-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex-1 overflow-auto border border-border/60 rounded-lg max-h-72">
        {objects.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">No objects found.</p>
        ) : (
          <ul>
            {objects.map((obj) => {
              const isSelected = selectedObject === obj.apiName;
              const inTarget = highlightSet?.has(obj.apiName);
              return (
                <li key={obj.apiName}>
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() => onSelectObject?.(obj.apiName)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs border-b border-border/30 transition-colors',
                      selectable && 'hover:bg-secondary/60 cursor-pointer',
                      !selectable && 'cursor-default',
                      isSelected && 'bg-primary/10 text-primary font-medium',
                      inTarget && !isSelected && 'bg-emerald-500/5',
                    )}
                  >
                    <span className="block font-medium">{obj.label}</span>
                    <span className="block font-mono text-muted-foreground">{obj.apiName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function OrgToOrgObjectBrowser({
  sourceObjects,
  targetObjects,
  selectedObject,
  onSelectObject,
  loading,
}: OrgToOrgObjectBrowserProps) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filter = (list: OrgToOrgObjectInfo[]) =>
    q
      ? list.filter(
          (o) => o.apiName.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
        )
      : list;

  const filteredSource = filter(sourceObjects);
  const filteredTarget = filter(targetObjects);
  const targetSet = new Set(targetObjects.map((o) => o.apiName));

  return (
    <div className={cn('space-y-3', loading && 'opacity-60 pointer-events-none')}>
      <div>
        <Label>Search objects</Label>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name or API name…"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ObjectList
          title="Source objects"
          subtitle="Click an object to load records to deploy"
          objects={filteredSource}
          selectedObject={selectedObject}
          onSelectObject={onSelectObject}
          selectable
          highlightSet={targetSet}
        />
        <ObjectList
          title="Target objects"
          subtitle="Reference — objects available in target org"
          objects={filteredTarget}
          selectedObject={selectedObject}
          highlightSet={targetSet}
        />
      </div>
      {selectedObject && targetSet.has(selectedObject) && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          {selectedObject} exists in both source and target orgs.
        </p>
      )}
      {selectedObject && !targetSet.has(selectedObject) && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {selectedObject} is not present in the target org object list (deploy may still create records).
        </p>
      )}
    </div>
  );
}
