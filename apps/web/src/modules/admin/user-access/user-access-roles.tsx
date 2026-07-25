'use client';

import { Code2, Eye, GitBranch, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/studio';
import { cn } from '@/utils/cn';
import type { UserAccessRow } from './types';

interface RoleDef {
  role: string;
  icon: LucideIcon;
  description: string;
  accent: string;
}

const ROLE_DEFS: RoleDef[] = [
  {
    role: 'Super Admin',
    icon: Shield,
    description: 'Full access to every module plus the User Access console.',
    accent: 'text-purple-300 bg-purple-500/10',
  },
  {
    role: 'Integration',
    icon: GitBranch,
    description: 'Deployment and Data modules — CI/CD pipelines and data movement.',
    accent: 'text-blue-300 bg-blue-500/10',
  },
  {
    role: 'Developer',
    icon: Code2,
    description:
      'Two or more advanced modules (deployment, org setup, provisioning, monitoring, or copilot).',
    accent: 'text-cyan-300 bg-cyan-500/10',
  },
  {
    role: 'Viewer',
    icon: Eye,
    description: 'Baseline access: dashboard, environment, data, and the developer board.',
    accent: 'text-muted-foreground bg-secondary',
  },
];

export function UserAccessRoles({ users }: { users: UserAccessRow[] }) {
  const countFor = (role: string) => users.filter((u) => u.displayRole === role).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:gap-5 sm:grid-cols-2">
        {ROLE_DEFS.map((def) => {
          const count = countFor(def.role);
          return (
            <GlassCard key={def.role} className="hover:border-primary/25">
              <div className="flex items-start gap-3.5">
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-white/5',
                    def.accent,
                  )}
                >
                  <def.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">{def.role}</h3>
                    <span className="shrink-0 rounded-full border border-border/70 bg-secondary/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
                      {count} user{count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/65">{def.description}</p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
      <p className="text-sm leading-relaxed text-foreground/60">
        Roles are derived from each user&apos;s platform role and granted modules. Use{' '}
        <span className="font-medium text-foreground">Manage</span> on a user to change their role or
        module access.
      </p>
    </div>
  );
}
