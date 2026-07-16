'use client';

import { ArrowRight, ClipboardList, Grid3X3, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserAccessTab } from './types';

interface QuickCard {
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
  tab: UserAccessTab;
}

const CARDS: QuickCard[] = [
  {
    title: 'Role Management',
    description: 'Review platform roles and how they are derived',
    action: 'View Roles',
    icon: Shield,
    tab: 'roles',
  },
  {
    title: 'Permission Matrix',
    description: 'See which modules each role can access',
    action: 'View Matrix',
    icon: Grid3X3,
    tab: 'permissions',
  },
  {
    title: 'Audit Logs',
    description: 'Track access changes and security events',
    action: 'View Logs',
    icon: ClipboardList,
    tab: 'activity',
  },
];

export function UserAccessQuickCards({
  onNavigate,
}: {
  onNavigate: (tab: UserAccessTab) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {CARDS.map((c) => (
        <button
          key={c.title}
          type="button"
          onClick={() => onNavigate(c.tab)}
          className="group rounded-xl border border-border/60 bg-card/60 p-5 text-left transition-colors hover:border-primary/30 hover:bg-card/80"
        >
          <c.icon className="mb-3 h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">{c.title}</h3>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">{c.description}</p>
          <span className="inline-flex items-center gap-1 text-xs text-primary">
            {c.action}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      ))}
    </div>
  );
}
