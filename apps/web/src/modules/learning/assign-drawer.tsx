'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';
import { LEVEL_THEMES, levelLabel } from './learning-ui';
import type { AssignDraft } from './use-team-workspace';
import type { LearningAdminLearnerRow, LearningPathSummary } from './types';

interface AssignDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learners: LearningAdminLearnerRow[];
  paths: LearningPathSummary[];
  draft: AssignDraft;
  onDraftChange: (draft: AssignDraft) => void;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
}

function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AssignDrawer({
  open,
  onOpenChange,
  learners,
  paths,
  draft,
  onDraftChange,
  saving,
  error,
  onSubmit,
}: AssignDrawerProps) {
  const [search, setSearch] = useState('');

  const filteredLearners = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return learners;
    return learners.filter(
      (learner) =>
        learner.displayName.toLowerCase().includes(term) ||
        learner.email.toLowerCase().includes(term),
    );
  }, [learners, search]);

  const toggleUser = (userId: string) => {
    if (!learners.find((learner) => learner.userId === userId)?.hasLearningAccess) return;
    onDraftChange({
      ...draft,
      userIds: draft.userIds.includes(userId)
        ? draft.userIds.filter((id) => id !== userId)
        : [...draft.userIds, userId],
    });
  };

  const togglePath = (pathId: string) => {
    onDraftChange({
      ...draft,
      pathIds: draft.pathIds.includes(pathId)
        ? draft.pathIds.filter((id) => id !== pathId)
        : [...draft.pathIds, pathId],
    });
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <div className="border-b border-border p-4">
          <SheetHeader className="pr-8">
            <SheetTitle>Assign training</SheetTitle>
            <SheetDescription>
              Training can be assigned only after Academy is enabled in User Access.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto scrollbar-thin p-4">
          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {learners.some((learner) => !learner.hasLearningAccess) && (
            <p className="rounded-md border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
              Learners marked “No Academy access” cannot be selected.{' '}
              <Link href="/admin/users" className="font-medium underline underline-offset-2">
                Grant access in Admin → User Access
              </Link>{' '}
              first.
            </p>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">
              Learning paths <span className="text-muted-foreground">({draft.pathIds.length} selected)</span>
            </p>
            <div className="space-y-2">
              {paths.map((path) => {
                const selected = draft.pathIds.includes(path.id);
                return (
                  <button
                    key={path.id}
                    type="button"
                    onClick={() => togglePath(path.id)}
                    aria-pressed={selected}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/60 hover:bg-secondary/30',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{path.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {path.moduleCount} modules · ~{path.estimatedHours}h
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        LEVEL_THEMES[path.level].badge,
                      )}
                    >
                      {levelLabel(path.level)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Learners <span className="text-muted-foreground">({draft.userIds.length} selected)</span>
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or email…"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
              {filteredLearners.map((learner) => (
                <label
                  key={learner.userId}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm',
                    learner.hasLearningAccess
                      ? 'cursor-pointer hover:bg-secondary/30'
                      : 'cursor-not-allowed opacity-60',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{learner.displayName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{learner.email}</p>
                    {!learner.hasLearningAccess && (
                      <p className="text-[10px] font-medium text-amber-300">No Academy access</p>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="size-4 shrink-0"
                    checked={draft.userIds.includes(learner.userId)}
                    disabled={!learner.hasLearningAccess}
                    onChange={() => toggleUser(learner.userId)}
                  />
                </label>
              ))}
              {filteredLearners.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No learners match “{search}”.
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Due date (optional)</p>
            <Input
              type="date"
              value={draft.dueAt}
              min={localDateInputValue()}
              onChange={(event) => onDraftChange({ ...draft, dueAt: event.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Note to learners (optional)</p>
            <Textarea
              value={draft.note}
              onChange={(event) => onDraftChange({ ...draft, note: event.target.value })}
              placeholder="e.g. Complete before your onboarding review."
              rows={2}
              maxLength={500}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={draft.userIds.length === 0 || draft.pathIds.length === 0}
            onClick={onSubmit}
          >
            Assign {draft.pathIds.length > 0 && draft.userIds.length > 0
              ? `(${draft.pathIds.length * draft.userIds.length})`
              : ''}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
