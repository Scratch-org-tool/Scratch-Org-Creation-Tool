'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  ClipboardList,
  Clock,
  GraduationCap,
  Plus,
  Target,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { GlassCard, InlineAlert, KpiCard, PageHeader } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { AssignDrawer } from './assign-drawer';
import { LEVEL_THEMES, formatDate, formatRelative, levelLabel } from './learning-ui';
import { useTeamWorkspace } from './use-team-workspace';
import type { LearningAdminLearnerRow } from './types';

function LearnerPathList({
  learner,
  onRevoke,
  revokingId,
}: {
  learner: LearningAdminLearnerRow;
  onRevoke: (assignmentId: string) => void;
  revokingId: string | null;
}) {
  return (
    <div className="space-y-2 border-t border-border/60 bg-secondary/10 px-4 py-3">
      {learner.paths.map((path) => {
        const theme = LEVEL_THEMES[path.level];
        const inactive = !path.assigned && path.progressPercent === 0;
        return (
          <div
            key={path.pathId}
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2.5',
              inactive && 'opacity-55',
            )}
          >
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', theme.badge)}>
              {levelLabel(path.level)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{path.title}</p>
                {path.assigned && (
                  <span className="rounded-full bg-sky-500/15 px-2 py-px text-[10px] font-medium text-sky-300">
                    Assigned{path.dueAt ? ` · due ${formatDate(path.dueAt)}` : ''}
                  </span>
                )}
                {path.completed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-px text-[10px] font-medium text-emerald-300">
                    <Award className="size-2.5" />
                    Completed
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                  <div
                    className={cn('h-full rounded-full', theme.bar)}
                    style={{ width: `${path.progressPercent}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {path.progressPercent}%
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {path.lessonsCompleted}/{path.lessonCount} lessons · {path.modulesCompleted}/
                {path.moduleCount} modules
                {path.averageScorePercent !== null ? ` · avg quiz ${path.averageScorePercent}%` : ''}
              </p>
            </div>
            {path.assigned && path.assignmentId && !path.completed && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-[11px] text-muted-foreground hover:text-destructive shrink-0"
                loading={revokingId === path.assignmentId}
                onClick={() => onRevoke(path.assignmentId!)}
              >
                <X className="size-3" />
                Revoke
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LearnerRow({
  learner,
  expanded,
  onToggle,
  onAssign,
  onRevoke,
  revokingId,
}: {
  learner: LearningAdminLearnerRow;
  expanded: boolean;
  onToggle: () => void;
  onAssign: () => void;
  onRevoke: (assignmentId: string) => void;
  revokingId: string | null;
}) {
  const overall =
    learner.paths.length > 0
      ? Math.round(
          learner.paths.reduce((sum, path) => sum + path.progressPercent, 0) / learner.paths.length,
        )
      : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-secondary/20"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{learner.displayName}</p>
            {!learner.hasLearningAccess && (
              <span className="rounded-full bg-secondary/60 px-2 py-px text-[10px] text-muted-foreground">
                No academy access
              </span>
            )}
            {learner.activeAssignments > 0 && (
              <span className="rounded-full bg-sky-500/15 px-2 py-px text-[10px] font-medium text-sky-300">
                {learner.completedAssignments}/{learner.activeAssignments} assigned done
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{learner.email}</p>
        </div>

        <div className="hidden shrink-0 items-center gap-6 text-center md:flex">
          <div>
            <p className="text-sm font-semibold tabular-nums">{learner.lessonsCompleted}</p>
            <p className="text-[10px] text-muted-foreground">Lessons</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">{learner.quizzesPassed}</p>
            <p className="text-[10px] text-muted-foreground">Quizzes</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {learner.averageScorePercent !== null ? `${learner.averageScorePercent}%` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">Avg score</p>
          </div>
          <div className="w-24">
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-400"
                style={{ width: `${overall}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">{overall}% overall</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1 text-[11px] text-muted-foreground lg:inline-flex">
            <Clock className="size-3" />
            {formatRelative(learner.lastActivityAt)}
          </span>
          <ChevronDown
            className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')}
          />
        </div>
      </button>

      {expanded && (
        <>
          <div className="flex items-center justify-end border-t border-border/60 bg-secondary/10 px-4 pt-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onAssign}>
              <Plus className="size-3" />
              Assign training
            </Button>
          </div>
          <LearnerPathList learner={learner} onRevoke={onRevoke} revokingId={revokingId} />
        </>
      )}
    </div>
  );
}

export function TeamWorkspace() {
  const {
    isAdmin,
    profileLoading,
    overview,
    paths,
    loading,
    error,
    notice,
    setNotice,
    drawerOpen,
    setDrawerOpen,
    draft,
    setDraft,
    saving,
    saveError,
    openDrawer,
    submitAssignments,
    revoke,
    revokingId,
    engagementRate,
  } = useTeamWorkspace();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!profileLoading && !isAdmin) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <InlineAlert variant="warning" title="Administrator access required">
          Team Academy progress is only visible to administrators.{' '}
          <Link className="underline" href="/learning">
            Back to your academy
          </Link>
        </InlineAlert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Link
        href="/learning"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Salesforce Academy
      </Link>

      <PageHeader
        title="Team Academy Progress"
        subtitle="Assign training paths and track every learner's lessons, quiz scores, and completions."
        showBreadcrumbs={false}
        actions={
          <Button className="gap-1.5" onClick={() => openDrawer()}>
            <ClipboardList className="size-4" />
            Assign training
          </Button>
        }
      />

      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      {notice && (
        <InlineAlert variant="success" onDismiss={() => setNotice(null)}>
          {notice}
        </InlineAlert>
      )}

      {loading || !overview ? (
        !error && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[118px] rounded-lg" />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Learners"
              value={overview.totals.learners}
              icon={Users}
              iconClass="text-sky-300"
              accentColor="#38bdf8"
              trendLabel={
                engagementRate !== null
                  ? `${overview.totals.activeLearners} active (${engagementRate}%)`
                  : undefined
              }
            />
            <KpiCard
              label="Active assignments"
              value={overview.totals.activeAssignments}
              icon={Target}
              iconClass="text-violet-300"
              accentColor="#a78bfa"
              trendLabel={`${overview.totals.completedAssignments} completed`}
            />
            <KpiCard
              label="Lessons completed"
              value={overview.totals.lessonsCompleted}
              icon={BookOpenCheck}
              iconClass="text-emerald-300"
              accentColor="#34d399"
              trendLabel={`${overview.totals.quizzesPassed} quizzes passed`}
            />
            <KpiCard
              label="Team avg quiz score"
              value={
                overview.totals.averageScorePercent !== null
                  ? `${overview.totals.averageScorePercent}%`
                  : '—'
              }
              icon={BarChart3}
              iconClass="text-amber-300"
              accentColor="#fbbf24"
              trend="hidden"
            />
          </div>

          {overview.learners.length === 0 ? (
            <GlassCard>
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-secondary/50">
                  <GraduationCap className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No learners yet</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Active users appear here once they exist. Assign a path to get someone started.
                </p>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {overview.learners.length} learner{overview.learners.length === 1 ? '' : 's'}
                </h2>
                <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <UserCheck className="size-3" />
                  Assigning grants Academy access automatically
                </p>
              </div>
              {overview.learners.map((learner) => (
                <LearnerRow
                  key={learner.userId}
                  learner={learner}
                  expanded={expandedId === learner.userId}
                  onToggle={() =>
                    setExpandedId((current) => (current === learner.userId ? null : learner.userId))
                  }
                  onAssign={() => openDrawer(learner.userId)}
                  onRevoke={(assignmentId) => void revoke(assignmentId)}
                  revokingId={revokingId}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AssignDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        learners={overview?.learners ?? []}
        paths={paths}
        draft={draft}
        onDraftChange={setDraft}
        saving={saving}
        error={saveError}
        onSubmit={() => void submitAssignments()}
      />
    </div>
  );
}
