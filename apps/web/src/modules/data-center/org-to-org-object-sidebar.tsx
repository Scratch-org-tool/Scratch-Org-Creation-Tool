'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/cn';
import type { OrgToOrgObjectInfo } from './types';

interface OrgToOrgObjectSidebarProps {
  objects: OrgToOrgObjectInfo[];
  checkedObjects: Set<string>;
  activeObject: string | null;
  onToggle: (apiName: string, checked: boolean) => void;
  onFocus: (apiName: string) => void;
  loading?: boolean;
}

export function OrgToOrgObjectSidebar({
  objects,
  checkedObjects,
  activeObject,
  onToggle,
  onFocus,
  loading,
}: OrgToOrgObjectSidebarProps) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q
    ? objects.filter(
        (o) => o.apiName.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
      )
    : objects;

  return (
    <div className={cn('flex flex-col h-full min-h-0 border-r border-border/60', loading && 'opacity-60')}>
      <div className="p-3 border-b border-border/60">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search objects…"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground mt-2">
          {checkedObjects.size} selected · {objects.length} objects
        </p>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[32rem]">
        {filtered.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {loading ? 'Loading objects…' : 'No objects found.'}
          </p>
        ) : (
          <ul>
            {filtered.map((obj) => {
              const checked = checkedObjects.has(obj.apiName);
              const active = activeObject === obj.apiName;
              return (
                <li
                  key={obj.apiName}
                  className={cn(
                    'flex items-start gap-2 px-3 py-2 border-b border-border/30 text-xs cursor-pointer hover:bg-secondary/40',
                    active && 'bg-primary/10',
                  )}
                  onClick={() => onFocus(obj.apiName)}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggle(obj.apiName, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                    aria-label={`Include ${obj.label}`}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{obj.label}</span>
                    <span className="block font-mono text-muted-foreground truncate">{obj.apiName}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
