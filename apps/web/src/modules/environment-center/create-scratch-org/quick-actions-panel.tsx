'use client';

import Link from 'next/link';
import { BookOpen, FileStack, History, Sparkles, Trash2 } from 'lucide-react';
import { GlassCard } from '@/components/studio/glass-card';
import { cn } from '@/utils/cn';

const ACTIONS = [
  {
    label: 'View Documentation',
    shortName: 'Docs',
    href: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs.htm',
    external: true,
    icon: BookOpen,
    iconClass: 'bg-blue-500/10 text-blue-400',
  },
  {
    label: 'Scratch Org Templates',
    shortName: 'Templates',
    href: '/scratch-templates',
    icon: FileStack,
    iconClass: 'bg-violet-500/10 text-violet-400',
  },
  {
    label: 'Org History',
    shortName: 'History',
    href: '/environment-center?tab=salesforce#scratch-orgs',
    icon: History,
    iconClass: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    label: 'Bulk Org Cleanup',
    shortName: 'Cleanup',
    href: '/environment-center?tab=salesforce#scratch-orgs',
    icon: Trash2,
    iconClass: 'bg-orange-500/10 text-orange-400',
  },
] as const;

const actionButtonClass =
  'flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-2 py-2.5 min-h-[4.75rem] hover:border-primary/30 hover:bg-card/70 transition-colors text-center';

function QuickActionButton({
  action,
}: {
  action: (typeof ACTIONS)[number];
}) {
  const content = (
    <>
      <span
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          action.iconClass,
        )}
      >
        <action.icon className="w-4 h-4" />
      </span>
      <span className="text-[11px] font-medium leading-tight text-foreground/90 line-clamp-2">
        {action.shortName}
      </span>
    </>
  );

  if ('external' in action && action.external) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noreferrer"
        title={action.label}
        aria-label={action.label}
        className={actionButtonClass}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={action.href} title={action.label} aria-label={action.label} className={actionButtonClass}>
      {content}
    </Link>
  );
}

export function QuickActionsPanel({ className }: { className?: string }) {
  return (
    <GlassCard
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Quick Actions
        </span>
      }
      className={className}
      contentClassName="pt-0"
    >
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => (
          <QuickActionButton key={action.label} action={action} />
        ))}
      </div>
    </GlassCard>
  );
}
