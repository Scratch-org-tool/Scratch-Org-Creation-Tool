'use client';

import { Check, Minus } from 'lucide-react';
import {
  APP_MODULES,
  DEFAULT_USER_MODULES,
  LEARNING_FEATURE_LABELS,
  LEARNING_FEATURES,
  LEARNING_PATH_LABELS,
  LEARNING_PATH_IDS,
  LOCKED_MODULES,
  MODULE_LABELS,
  type AppModule,
} from '@sfcc/shared';
import { GlassCard } from '@/components/studio';
import { cn } from '@/utils/cn';

const COLUMNS = [
  { key: 'default', label: 'New users (default)' },
  { key: 'grantable', label: 'Grantable to users' },
  { key: 'admin', label: 'Admin' },
] as const;

const defaultSet = new Set<AppModule>(DEFAULT_USER_MODULES as readonly AppModule[]);
const grantableSet = new Set<AppModule>(LOCKED_MODULES as readonly AppModule[]);

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

export function UserAccessPermissions() {
  return (
    <div className="space-y-4">
      <GlassCard
        title="Permission matrix"
        description="Which modules each role can access. Admins always have every module."
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">MODULE</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-center font-medium">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {APP_MODULES.map((module) => {
                const isDefault = defaultSet.has(module);
                const isGrantable = grantableSet.has(module);
                return (
                  <tr
                    key={module}
                    className="border-b border-border/40 last:border-0 hover:bg-secondary/20"
                  >
                    <td className="px-4 py-3 font-medium">{MODULE_LABELS[module]}</td>
                    <Cell on={isDefault} />
                    <Cell on={isGrantable} />
                    <Cell on />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={cn('flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-xs text-muted-foreground')}>
          <span>
            <span className="font-medium text-foreground">Default</span> — auto-granted to every new
            account.
          </span>
          <span>
            <span className="font-medium text-foreground">Grantable</span> — enabled per user from the
            Manage drawer.
          </span>
        </div>
      </GlassCard>

      <GlassCard
        title="Salesforce Academy sub-permissions"
        description="After the Salesforce Academy module is granted, admins choose which training tracks and in-lesson features the user may see. Ungranted tracks and features stay completely hidden."
        noPadding
      >
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Training tracks
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {LEARNING_PATH_IDS.map((pathId) => (
                <li key={pathId} className="rounded-md border border-border/50 px-3 py-2">
                  {LEARNING_PATH_LABELS[pathId]}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lesson features
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {LEARNING_FEATURES.map((feature) => (
                <li key={feature} className="rounded-md border border-border/50 px-3 py-2">
                  {LEARNING_FEATURE_LABELS[feature]}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
          New tracks (Hands-on Lab, JavaScript, Java, Release Management) require an explicit grant.
          Salesforce core tracks remain the default when Academy is enabled without a saved track
          list. Assigning a path from Academy Progress also grants that track automatically.
        </div>
      </GlassCard>
    </div>
  );
}
