'use client';

import { ArrowRight, ClipboardList, Grid3X3, Shield } from 'lucide-react';
import { cn } from '@/utils/cn';

const CARDS = [
  {
    title: 'Role Management',
    description: 'Create and manage custom roles and permissions',
    action: 'Manage Roles',
    icon: Shield,
  },
  {
    title: 'Permission Matrix',
    description: 'View detailed permission matrix for all roles',
    action: 'View Matrix',
    icon: Grid3X3,
  },
  {
    title: 'Audit Logs',
    description: 'Track user access and permission changes',
    action: 'View Logs',
    icon: ClipboardList,
  },
];

export function UserAccessQuickCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {CARDS.map((c) => (
        <div
          key={c.title}
          className="rounded-xl border border-border/60 bg-card/60 p-5 opacity-60"
          title="Coming soon"
        >
          <c.icon className="w-5 h-5 text-primary mb-3" />
          <h3 className="font-semibold text-sm">{c.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{c.description}</p>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs text-muted-foreground cursor-not-allowed',
            )}
            title="Coming soon"
          >
            {c.action}
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      ))}
    </div>
  );
}
