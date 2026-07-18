'use client';

import { Check, Minus } from 'lucide-react';
import {
  APP_MODULES,
  DEFAULT_USER_MODULES,
  LOCKED_MODULES,
  MODULE_LABELS,
  REVOCABLE_DEFAULT_MODULES,
  type AppModule,
} from '@sfcc/shared';
import { GlassCard } from '@/components/studio';
import { cn } from '@/utils/cn';

const defaultSet = new Set<AppModule>(DEFAULT_USER_MODULES as readonly AppModule[]);
const grantableSet = new Set<AppModule>(LOCKED_MODULES as readonly AppModule[]);
const revocableSet = new Set<AppModule>(REVOCABLE_DEFAULT_MODULES as readonly AppModule[]);

function Cell({ on }: { on: boolean }) {
  return (
    <td className="px-4 py-3 text-center">
      {on ? (
        <Check className="mx-auto h-4 w-4 text-emerald-400" aria-label="Yes" />
      ) : (
        <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="No" />
      )}
    </td>
  );
}

function controlLabel(module: AppModule): { text: string; className: string } {
  if (grantableSet.has(module)) {
    return { text: 'Grant per user', className: 'bg-sky-500/15 text-sky-300' };
  }
  if (revocableSet.has(module)) {
    return { text: 'On by default · revocable', className: 'bg-emerald-500/15 text-emerald-300' };
  }
  return { text: 'Always on (landing page)', className: 'bg-secondary/60 text-muted-foreground' };
}

export function UserAccessPermissions() {
  return (
    <GlassCard
      title="Permission matrix"
      description="Every module is controlled per user from the Manage drawer. Admins always have every module."
      noPadding
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">MODULE</th>
              <th className="px-4 py-3 text-center font-medium">New users (default)</th>
              <th className="px-4 py-3 text-center font-medium">Per-user control</th>
              <th className="px-4 py-3 text-center font-medium">Admin</th>
            </tr>
          </thead>
          <tbody>
            {APP_MODULES.map((module) => {
              const control = controlLabel(module);
              return (
                <tr
                  key={module}
                  className="border-b border-border/40 last:border-0 hover:bg-secondary/20"
                >
                  <td className="px-4 py-3 font-medium">{MODULE_LABELS[module]}</td>
                  <Cell on={defaultSet.has(module)} />
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
                        control.className,
                      )}
                    >
                      {control.text}
                    </span>
                  </td>
                  <Cell on />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={cn('flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-xs text-muted-foreground')}>
        <span>
          <span className="font-medium text-foreground">On by default · revocable</span> — granted
          automatically, but an admin can switch it off per user.
        </span>
        <span>
          <span className="font-medium text-foreground">Grant per user</span> — invisible until an
          admin enables it from the Manage drawer.
        </span>
        <span>
          <span className="font-medium text-foreground">Academy scope</span> — with Salesforce
          Academy granted, admins can additionally restrict a user to assigned training paths only.
        </span>
      </div>
    </GlassCard>
  );
}
