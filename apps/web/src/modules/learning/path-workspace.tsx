'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  FileQuestion,
  PlayCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { resolveLearningFeatureAccess } from '@sfcc/shared';
import { InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/utils/cn';
import { fetchPath } from './learning-api';
import { LEVEL_THEMES, formatDuration, levelLabel } from './learning-ui';
import { ProgressRing } from './progress-ring';
import type { LearningModuleMeta, LearningPathSummary } from './types';

function QuizRow({ module }: { module: LearningModuleMeta }) {
  const { quiz } = module;
  const allLessonsDone = module.lessons.every((lesson) => lesson.completed);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
        quiz.passed
          ? 'border-emerald-400/25 bg-emerald-500/8'
          : 'border-border/60 bg-secondary/20',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {quiz.passed ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
        ) : (
          <FileQuestion className="size-4 shrink-0 text-sky-300" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">
            Module quiz
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-1.5 py-px text-[10px] font-medium text-violet-300">
              <Sparkles className="size-2.5" />
              AI-generated
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            {quiz.questionCount} questions · pass at {quiz.passPercent}%
            {quiz.attemptCount > 0 && quiz.bestScorePercent !== null
              ? ` · best ${quiz.bestScorePercent}% over ${quiz.attemptCount} attempt${quiz.attemptCount === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        variant={quiz.passed ? 'outline' : 'default'}
        className="gap-1.5 shrink-0"
        title={allLessonsDone ? undefined : 'You can take the quiz anytime — finishing the lessons first is recommended'}
      >
        <Link href={`/learning/modules/${module.id}/quiz`}>
          {quiz.passed ? (
            <>
              <RotateCcw className="size-3.5" />
              Retake
            </>
          ) : quiz.attemptCount > 0 ? (
            <>
              <RotateCcw className="size-3.5" />
              Retry quiz
            </>
          ) : (
            <>
              <PlayCircle className="size-3.5" />
              Take quiz
            </>
          )}
        </Link>
      </Button>
    </div>
  );
}

function ModuleCard({
  module,
  index,
  accent,
  isNext,
  quizEnabled,
}: {
  module: LearningModuleMeta;
  index: number;
  accent: string;
  isNext: boolean;
  quizEnabled: boolean;
}) {
  return (
    <div
      className={cn(
        'relative rounded-xl border bg-card/60 p-5 transition-colors',
        module.completed
          ? 'border-emerald-400/25'
          : isNext
            ? 'border-primary/40'
            : 'border-border/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            {module.completed ? <CheckCircle2 className="size-5" /> : index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{module.title}</h3>
              {isNext && !module.completed && (
                <span className="rounded-full bg-primary/15 px-2 py-px text-[10px] font-medium text-primary">
                  Recommended next
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{module.summary}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              {formatDuration(module.durationMinutes)}
              {quizEnabled ? ' + quiz' : ''}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <ProgressRing percent={module.progressPercent} size={44} strokeWidth={4} accent={accent} />
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {module.lessons.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/learning/lessons/${lesson.id}`}
            className="group flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border/60 hover:bg-secondary/30"
          >
            <div className="flex min-w-0 items-center gap-3">
              {lesson.completed ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/50" />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    'truncate text-sm',
                    lesson.completed ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {lesson.title}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
              <span>{lesson.durationMinutes} min</span>
              <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </Link>
        ))}
        {quizEnabled && <QuizRow module={module} />}
      </div>
    </div>
  );
}

export function PathWorkspace() {
  const params = useParams<{ pathId: string }>();
  const pathId = params?.pathId;
  const { profile } = useAuth();
  const quizEnabled = resolveLearningFeatureAccess(profile).quiz;
  const [path, setPath] = useState<LearningPathSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pathId) return;
    try {
      setError(null);
      setPath(await fetchPath(pathId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this learning path');
    } finally {
      setLoading(false);
    }
  }, [pathId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextModuleId = path?.modules.find((module) => !module.completed)?.id;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <Link
        href="/learning"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Salesforce Academy
      </Link>

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {loading || !path ? (
        !error && (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                background: `radial-gradient(ellipse 55% 90% at 90% 0%, ${LEVEL_THEMES[path.level].accent}22, transparent)`,
              }}
            />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                      LEVEL_THEMES[path.level].badge,
                    )}
                  >
                    {levelLabel(path.level)}
                  </span>
                  {path.completed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                      <Award className="size-3" />
                      {path.badge} earned
                    </span>
                  )}
                  {path.assignment && (
                    <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
                      Assigned by {path.assignment.assignedByName ?? 'admin'}
                    </span>
                  )}
                </div>
                <h1 className="mt-2 text-2xl font-bold">{path.title}</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {path.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="size-3.5" />
                    {path.moduleCount} modules · {path.lessonCount} lessons
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    ~{path.estimatedHours} hours
                  </span>
                </div>
              </div>
              <ProgressRing
                percent={path.progressPercent}
                size={96}
                strokeWidth={7}
                accent={LEVEL_THEMES[path.level].accent}
                label={`${path.title} progress`}
              />
            </div>
          </div>

          <div className="space-y-4">
            {path.modules.map((module, index) => (
              <ModuleCard
                key={module.id}
                module={module}
                index={index}
                accent={LEVEL_THEMES[path.level].accent}
                isNext={module.id === nextModuleId}
                quizEnabled={quizEnabled}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
