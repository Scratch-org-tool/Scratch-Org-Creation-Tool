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
            'relative px-4 py-2.5 text-sm font-medium transition-colors',
            active === t.id
              ? 'text-primary after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:rounded-full after:bg-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
