'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GlassCard } from './glass-card';

export interface WorkspaceTab {
  id: string;
  label: string;
  icon: LucideIcon;
  title?: string;
  description?: string;
}

interface TabbedWorkspaceShellProps {
  header: React.ReactNode;
  tabs: WorkspaceTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  cardTitle?: string;
  cardDescription?: string;
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/25',
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

export function TabbedWorkspaceShell({
  header,
  tabs,
  activeTab,
  onTabChange,
  children,
  cardTitle,
  cardDescription,
}: TabbedWorkspaceShellProps) {
  const active = tabs.find((t) => t.id === activeTab);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {header}
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </div>
      )}
      <GlassCard
        title={cardTitle ?? active?.title}
        description={cardDescription ?? active?.description}
        contentClassName="min-w-0 overflow-hidden"
      >
        {children}
      </GlassCard>
    </div>
  );
}
