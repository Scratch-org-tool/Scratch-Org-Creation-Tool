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
  LEARNING_CORE_PATH_IDS,
  LEARNING_FEATURES,
  LEARNING_FEATURE_LABELS,
  LEARNING_PATH_IDS,
  LEARNING_PATH_LABELS,
  LOCKED_MODULES,
  MODULE_LABELS,
  type AppModule,
  type LearningFeature,
  type LearningPathId,
} from '@sfcc/shared';
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
  onToggleLearningPath: (pathId: LearningPathId) => void;
  onToggleLearningFeature: (feature: LearningFeature) => void;
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
  onToggleLearningPath,
  onToggleLearningFeature,
  onSave,
  isSelf,
}: UserAccessManageDrawerProps) {
  const learningEnabled =
    draft?.role === 'admin' || Boolean(draft?.grantedModules.includes('learning'));

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
                      disabled={saving}
                      onChange={() => onToggleModule(module)}
                      className="h-4 w-4"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {draft.role !== 'admin' && learningEnabled && (
            <>
              <div>
                <p className="text-sm font-medium mb-1">Academy training tracks</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Only checked tracks appear for this user. Unchecked tracks stay completely hidden.
                  Defaults (when none saved) are the Salesforce core tracks only.
                </p>
                <div className="space-y-2">
                  {LEARNING_PATH_IDS.map((pathId) => {
                    const checked =
                      draft.grantedLearningPaths.length > 0
                        ? draft.grantedLearningPaths.includes(pathId)
                        : (LEARNING_CORE_PATH_IDS as readonly string[]).includes(pathId);
                    return (
                      <label
                        key={pathId}
                        className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm cursor-pointer hover:bg-secondary/30"
                      >
                        <span>{LEARNING_PATH_LABELS[pathId]}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={() => onToggleLearningPath(pathId)}
                          className="h-4 w-4"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Academy features</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Features that are off do not appear in the learner UI and are blocked by the API.
                </p>
                <div className="space-y-2">
                  {LEARNING_FEATURES.map((feature) => {
                    const checked =
                      draft.grantedLearningFeatures.length > 0
                        ? draft.grantedLearningFeatures.includes(feature)
                        : true;
                    return (
                      <label
                        key={feature}
                        className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm cursor-pointer hover:bg-secondary/30"
                      >
                        <span>{LEARNING_FEATURE_LABELS[feature]}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={() => onToggleLearningFeature(feature)}
                          className="h-4 w-4"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {draft.role === 'admin' && (
            <p className="text-xs text-muted-foreground">
              Admins have access to all modules, Academy tracks, and Academy features automatically.
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
