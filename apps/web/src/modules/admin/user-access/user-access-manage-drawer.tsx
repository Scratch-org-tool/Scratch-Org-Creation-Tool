'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LOCKED_MODULES, MODULE_LABELS, type AppModule } from '@/lib/auth-utils';
import { cn } from '@/utils/cn';
import type { ManageDraft, UserAccessRow } from './types';

interface UserAccessManageDrawerProps {
  user: UserAccessRow | null;
  draft: ManageDraft | null;
  saving: boolean;
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
  onClose,
  onDraftChange,
  onToggleModule,
  onSave,
  isSelf,
}: UserAccessManageDrawerProps) {
  if (!user || !draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-md h-full bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Manage access</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">Account status</p>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <span className="text-sm">{draft.status === 'active' ? 'Active' : 'Inactive'}</span>
              <Switch
                checked={draft.status === 'active'}
                disabled={isSelf}
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
                  disabled={isSelf}
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
              <p className="text-sm font-medium mb-2">Module access</p>
              <div className="space-y-2">
                {LOCKED_MODULES.map((module) => (
                  <label
                    key={module}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm cursor-pointer hover:bg-secondary/30"
                  >
                    <span>{MODULE_LABELS[module]}</span>
                    <input
                      type="checkbox"
                      checked={draft.grantedModules.includes(module)}
                      onChange={() => onToggleModule(module)}
                      className="h-4 w-4"
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
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" loading={saving} disabled={isSelf} onClick={onSave}>
            Save changes
          </Button>
        </div>
      </aside>
    </div>
  );
}
