'use client';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  LOCKED_MODULES,
  MODULE_DESCRIPTIONS,
  MODULE_LABELS,
  type AppModule,
} from '@/lib/auth-utils';
import { cn } from '@/utils/cn';
import type { ManageDraft, UserAccessRow } from './types';

interface UserAccessManageDrawerProps {
  user: UserAccessRow | null;
  draft: ManageDraft | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onDraftChange: (draft: ManageDraft) => void;
  onToggleModule: (module: AppModule) => void;
  onSave: () => void;
  isSelf: boolean;
}

export function UserAccessManageDrawer({
  user,
  draft,
  saving,
  error,
  onClose,
  onDraftChange,
  onToggleModule,
  onSave,
  isSelf,
}: UserAccessManageDrawerProps) {
  const selectedFeatureCount = draft
    ? LOCKED_MODULES.filter((module) => draft.grantedModules.includes(module)).length
    : 0;

  return (
    <Sheet open={Boolean(user && draft)} onOpenChange={(open) => !open && !saving && onClose()}>
      {user && draft && (
      <SheetContent side="right" className="w-full max-w-md sm:max-w-md p-0 gap-0 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <SheetHeader className="pr-8">
            <SheetTitle>Manage access</SheetTitle>
            <SheetDescription>{user.email}</SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div>
            <p className="text-sm font-medium mb-2">Account status</p>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <span className="text-sm">{draft.status === 'active' ? 'Active' : 'Inactive'}</span>
              <Switch
                aria-label={`Set ${user.email} account ${draft.status === 'active' ? 'inactive' : 'active'}`}
                checked={draft.status === 'active'}
                disabled={isSelf || saving}
                onChange={(checked) =>
                  onDraftChange({ ...draft, status: checked ? 'active' : 'inactive' })
                }
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Platform role</p>
            <div className="grid grid-cols-2 gap-2">
              {(['user', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  disabled={isSelf || saving}
                  onClick={() => onDraftChange({ ...draft, role })}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm capitalize transition-colors',
                    draft.role === role
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 hover:bg-secondary/40',
                  )}
                >
                  {role === 'admin' ? 'Super Admin' : 'Standard user'}
                </button>
              ))}
            </div>
          </div>

          {draft.role !== 'admin' && (
            <div>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Feature access</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Only selected features appear for this user. Dashboard remains available.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {selectedFeatureCount}/{LOCKED_MODULES.length}
                </span>
              </div>
              <div className="mb-2 flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={saving || selectedFeatureCount === LOCKED_MODULES.length}
                  onClick={() =>
                    onDraftChange({ ...draft, grantedModules: [...LOCKED_MODULES] })
                  }
                >
                  Grant all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={saving || selectedFeatureCount === 0}
                  onClick={() => onDraftChange({ ...draft, grantedModules: [] })}
                >
                  Clear all
                </Button>
              </div>
              <div className="space-y-2">
                {LOCKED_MODULES.map((module) => (
                  <label
                    key={module}
                    className={cn(
                      'flex cursor-pointer items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-secondary/30',
                      draft.grantedModules.includes(module)
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/60',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{MODULE_LABELS[module]}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                        {MODULE_DESCRIPTIONS[module]}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.grantedModules.includes(module)}
                      disabled={saving}
                      onChange={() => onToggleModule(module)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {draft.role === 'admin' && (
            <p className="text-xs text-muted-foreground">
              Admins have access to all modules automatically.
            </p>
          )}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" loading={saving} disabled={isSelf} onClick={onSave}>
            Save changes
          </Button>
        </div>
      </SheetContent>
      )}
    </Sheet>
  );
}
