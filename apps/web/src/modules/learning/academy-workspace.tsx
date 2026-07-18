'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpenCheck,
  Clock,
  GraduationCap,
  Layers,
  PlayCircle,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import { LEARNING_CATEGORIES } from '@sfcc/shared';
import { GlassCard, InlineAlert, KpiCard, PageHeader } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/utils/cn';
import {
  CATEGORY_THEMES,
  LEVEL_THEMES,
  categoryLabel,
  categoryTagline,
  formatDate,
  formatDuration,
  levelLabel,
} from './learning-ui';
import { ProgressRing } from './progress-ring';
import { useAcademyWorkspace } from './use-academy-workspace';
import type { LearningCategory, LearningCatalogResponse, LearningPathSummary } from './types';

function HeroPanel({ catalog }: { catalog: LearningCatalogResponse }) {
  const { stats, continueTarget } = catalog;
  const trackCount = new Set(catalog.paths.map((path) => path.category)).size;
  const overall =
    stats.totalLessons + stats.totalModules > 0
      ? Math.round(
          ((stats.lessonsCompleted + stats.quizzesPassed) /
            (stats.totalLessons + stats.totalModules)) *
            100,
        )
      : 0;

  const continueHref = continueTarget
    ? continueTarget.kind === 'lesson' && continueTarget.lessonId
      ? `/learning/lessons/${continueTarget.lessonId}`
      : `/learning/modules/${continueTarget.moduleId}/quiz`
    : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-6 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 85% 10%, rgba(56,189,248,0.16), transparent), radial-gradient(ellipse 50% 70% at 10% 100%, rgba(167,139,250,0.14), transparent)',
        }}
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-300">
            <Sparkles className="size-3.5" />
            AI-powered training
          </div>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold">
            Master Salesforce, JavaScript, Java &amp; DevOps — fresher to architect
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {catalog.paths.length} guided path{catalog.paths.length === 1 ? '' : 's'} across{' '}
            {trackCount} track{trackCount === 1 ? '' : 's'} — with real-world examples, code, curated
            resources, an AI mentor for every lesson, and instant quizzes after each module. Every
            completion and score is captured on your profile.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {continueHref && continueTarget ? (
              <Button asChild size="lg" className="gap-2">
                <Link href={continueHref}>
                  <PlayCircle className="size-4" />
                  {stats.lessonsCompleted > 0 ? 'Continue learning' : 'Start learning'}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-md bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300">
                <Trophy className="size-4" />
                All paths completed — outstanding!
              </span>
            )}
            {continueTarget && (
              <p className="text-xs text-muted-foreground">
                Next up:{' '}
                <span className="text-foreground">
                  {continueTarget.kind === 'lesson'
                    ? continueTarget.lessonTitle
                    : `${continueTarget.moduleTitle} — module quiz`}
                </span>{' '}
                in {continueTarget.pathTitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-5 shrink-0">
          <ProgressRing percent={overall} size={104} strokeWidth={8} accent="#38bdf8" label="Overall academy progress" />
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold">Overall progress</p>
            <p className="text-xs text-muted-foreground">
              {stats.lessonsCompleted}/{stats.totalLessons} lessons
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.quizzesPassed}/{stats.totalModules} quizzes passed
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.pathsCompleted}/{stats.totalPaths} paths completed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentRail({ paths }: { paths: LearningPathSummary[] }) {
  const assigned = paths.filter((path) => path.assignment && !path.completed);
  if (assigned.length === 0) return null;

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-2 text-base font-semibold">
          <Target className="size-4 text-sky-300" />
          Assigned to you
        </span>
      }
      description="Training your administrator asked you to complete."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {assigned.map((path) => {
          const theme = LEVEL_THEMES[path.level];
          return (
            <Link
              key={path.id}
              href={`/learning/paths/${path.id}`}
              className="group flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-secondary/20 p-4 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', theme.badge)}>
                    {levelLabel(path.level)}
                  </span>
                  {path.assignment?.dueAt && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                      <Clock className="size-3" />
                      Due {formatDate(path.assignment.dueAt)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold">{path.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Assigned by {path.assignment?.assignedByName ?? 'an administrator'}
                  {path.assignment?.note ? ` — “${path.assignment.note}”` : ''}
                </p>
              </div>
              <ProgressRing percent={path.progressPercent} size={52} strokeWidth={5} accent={theme.accent} />
            </Link>
          );
        })}
      </div>
    </GlassCard>
  );
}

function PathCard({ path }: { path: LearningPathSummary }) {
  const theme = LEVEL_THEMES[path.level];
  return (
    <Link
      href={`/learning/paths/${path.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/60 p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}aa, transparent)` }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex size-10 items-center justify-center rounded-lg', theme.iconWrap)}>
          <GraduationCap className="size-5" />
        </div>
        <div className="flex items-center gap-2">
          {path.completed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              <Award className="size-3" />
              {path.badge}
            </span>
          )}
          <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', theme.badge)}>
            {levelLabel(path.level)}
          </span>
        </div>
      </div>

      <h3 className="mt-3 text-base font-semibold group-hover:text-primary transition-colors">
        {path.title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{path.tagline}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {path.skills.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="rounded-md bg-secondary/50 px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Layers className="size-3" />
          {path.moduleCount} modules
        </span>
        <span className="inline-flex items-center gap-1">
          <BookOpenCheck className="size-3" />
          {path.lessonCount} lessons
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          ~{formatDuration(path.estimatedHours * 60)}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{path.progressPercent}% complete</span>
          <span className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
            {path.progressPercent > 0 ? 'Continue' : 'Start path'}
            <ArrowRight className="size-3" />
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary/60">
          <div
            className={cn('h-full rounded-full transition-all duration-500', theme.bar)}
            style={{ width: `${path.progressPercent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function AcademySkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function AcademyWorkspace() {
  const { catalog, loading, error } = useAcademyWorkspace();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        title="Salesforce Academy"
        subtitle="A guided journey from fresher to architect — with an AI mentor at every step."
        actions={
          isAdmin ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href="/learning/team">
                <Users className="size-4" />
                Team progress
              </Link>
            </Button>
          ) : undefined
        }
      />

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {loading || !catalog ? (
        !error && <AcademySkeleton />
      ) : (
        <>
          <HeroPanel catalog={catalog} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Lessons completed"
              value={`${catalog.stats.lessonsCompleted}/${catalog.stats.totalLessons}`}
              icon={BookOpenCheck}
              iconClass="text-sky-300"
              accentColor="#38bdf8"
              trend="hidden"
            />
            <KpiCard
              label="Quizzes passed"
              value={`${catalog.stats.quizzesPassed}/${catalog.stats.totalModules}`}
              icon={Target}
              iconClass="text-emerald-300"
              accentColor="#34d399"
              trend="hidden"
            />
            <KpiCard
              label="Average quiz score"
              value={
                catalog.stats.averageScorePercent !== null
                  ? `${catalog.stats.averageScorePercent}%`
                  : '—'
              }
              icon={BarChart3}
              iconClass="text-violet-300"
              accentColor="#a78bfa"
              trendLabel={`${catalog.stats.quizAttempts} attempt${catalog.stats.quizAttempts === 1 ? '' : 's'} total`}
            />
            <KpiCard
              label="Paths completed"
              value={`${catalog.stats.pathsCompleted}/${catalog.stats.totalPaths}`}
              icon={Trophy}
              iconClass="text-amber-300"
              accentColor="#fbbf24"
              trend="hidden"
            />
          </div>

          <AssignmentRail paths={catalog.paths} />

          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Learning paths</h2>
              <p className="text-xs text-muted-foreground">
                Beginner → Expert · {catalog.stats.totalLessons} lessons ·{' '}
                {catalog.stats.totalModules} module quizzes
              </p>
            </div>
            {groupByCategory(catalog.paths).map(({ category, paths }) => (
              <TrackSection key={category} category={category} paths={paths} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function groupByCategory(
  paths: LearningPathSummary[],
): Array<{ category: LearningCategory; paths: LearningPathSummary[] }> {
  return LEARNING_CATEGORIES.map((category) => ({
    category,
    paths: paths.filter((path) => path.category === category),
  })).filter((group) => group.paths.length > 0);
}

function TrackSection({
  category,
  paths,
}: {
  category: LearningCategory;
  paths: LearningPathSummary[];
}) {
  const theme = CATEGORY_THEMES[category];
  const completed = paths.filter((path) => path.completed).length;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-4 w-1 rounded-full"
            style={{ background: theme.accent }}
          />
          <div>
            <h3 className="text-sm font-semibold">{categoryLabel(category)}</h3>
            <p className="text-[11px] text-muted-foreground">{categoryTagline(category)}</p>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {paths.length} path{paths.length === 1 ? '' : 's'}
          {completed > 0 ? ` · ${completed} completed` : ''}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {paths.map((path) => (
          <PathCard key={path.id} path={path} />
        ))}
      </div>
    </section>
  );
}
