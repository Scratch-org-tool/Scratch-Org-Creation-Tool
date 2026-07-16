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
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {ROLE_DEFS.map((def) => (
          <GlassCard key={def.role}>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  def.accent,
                )}
              >
                <def.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{def.role}</h3>
                  <span className="rounded-md border border-border/60 bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground">
                    {countFor(def.role)} user{countFor(def.role) === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{def.description}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Roles are derived from each user&apos;s platform role and granted modules. Use{' '}
        <span className="font-medium text-foreground">Manage</span> on a user to change their role or
        module access.
      </p>
    </div>
  );
}
