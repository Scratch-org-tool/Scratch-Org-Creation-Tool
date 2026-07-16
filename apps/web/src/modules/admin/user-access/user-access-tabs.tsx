'use client';

import { cn } from '@/utils/cn';
import type { UserAccessTab } from './types';

const TABS: { id: UserAccessTab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'activity', label: 'Activity Logs' },
];

interface UserAccessTabsProps {
  active: UserAccessTab;
  onChange: (tab: UserAccessTab) => void;
}

export function UserAccessTabs({ active, onChange }: UserAccessTabsProps) {
  return (
    <div className="flex gap-1 border-b border-border/60">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            active === t.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
