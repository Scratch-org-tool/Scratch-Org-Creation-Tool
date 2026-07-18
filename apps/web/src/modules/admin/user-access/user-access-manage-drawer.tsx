'use client';

import { GraduationCap, Lock } from 'lucide-react';
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
  DEFAULT_USER_MODULES,
  LOCKED_MODULES,
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

/** Dashboard is the landing page + locked-route redirect target — always on. */
const ALWAYS_ON_MODULES: readonly AppModule[] = ['dashboard'];

function ModuleRow({
  module,
  checked,
  disabled,
  note,
  onToggle,
}: {
  module: AppModule;
  checked: boolean;
  disabled: boolean;
  note?: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate">{MODULE_LABELS[module]}</p>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
      <Switch
        aria-label={`${checked ? 'Disable' : 'Enable'} ${MODULE_LABELS[module]}`}
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
    </div>
  );
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
  const learningEnabled = draft
    ? draft.role === 'admin' ||
      (draft.grantedModules.includes('learning') && !draft.revokedModules.includes('learning'))
    : false;

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
            <>
              <div>
                <p className="text-sm font-medium mb-1">Core modules</p>
                <p className="text-xs text-muted-foreground mb-2">
                  On for every user by default — switch off to remove a module for this user.
                </p>
                <div className="space-y-2">
                  {DEFAULT_USER_MODULES.map((module) => {
                    const alwaysOn = ALWAYS_ON_MODULES.includes(module);
                    return (
                      <ModuleRow
                        key={module}
                        module={module}
                        checked={alwaysOn || !draft.revokedModules.includes(module)}
                        disabled={saving || alwaysOn}
                        note={alwaysOn ? 'Always on — the landing page for every account' : undefined}
                        onToggle={() => onToggleModule(module)}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
                  <Lock className="size-3.5 text-muted-foreground" />
                  Advanced modules
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Off until granted — the module is invisible to the user until you enable it.
                </p>
                <div className="space-y-2">
                  {LOCKED_MODULES.map((module) => (
                    <ModuleRow
                      key={module}
                      module={module}
                      checked={draft.grantedModules.includes(module)}
                      disabled={saving}
                      onToggle={() => onToggleModule(module)}
                    />
                  ))}
                </div>
              </div>

              {learningEnabled && (
                <div>
                  <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
                    <GraduationCap className="size-3.5 text-muted-foreground" />
                    Academy content scope
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Restrict the catalog to paths you assign from Academy Progress — unassigned
                    trainings will not appear for this user at all.
                  </p>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <span>
                      {draft.learningAssignedOnly ? 'Assigned paths only' : 'Full catalog'}
                    </span>
                    <Switch
                      aria-label="Restrict Academy to assigned paths"
                      checked={draft.learningAssignedOnly}
                      disabled={saving}
                      onChange={(checked) =>
                        onDraftChange({ ...draft, learningAssignedOnly: checked })
                      }
                    />
                  </div>
                </div>
              )}
            </>
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
