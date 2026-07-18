'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  Clock,
  ExternalLink,
  FileQuestion,
  Lightbulb,
  ListChecks,
  PlayCircle,
  Target,
} from 'lucide-react';
import type { ExplainerFocus } from '@sfcc/shared';
import { InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { completeLesson, fetchLesson } from './learning-api';
import {
  RESOURCE_SOURCE_BADGES,
  parseBody,
  resourceSourceLabel,
} from './learning-ui';
import { ExplainerDialog, type ExplainerRequestState } from './explainer-dialog';
import { MentorPanel } from './mentor-panel';
import { VideoSessionBlock } from './video-session-block';
import type { LearningLessonResponse, LearningLessonSection } from './types';

type LessonMode = 'read' | 'video';

function SectionBlock({ section }: { section: LearningLessonSection }) {
  const blocks = parseBody(section.body);
  return (
    <section>
      <h3 className="text-base font-semibold">{section.heading}</h3>
      <div className="mt-2 space-y-3">
        {blocks.map((block, index) =>
          block.kind === 'paragraph' ? (
            <p key={index} className="text-sm leading-relaxed text-foreground/85">
              {block.text}
            </p>
          ) : (
            <ul key={index} className="space-y-1.5 pl-1">
              {block.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-foreground/85">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/60" />
                  {item}
                </li>
              ))}
            </ul>
          ),
        )}
        {section.code && (
          <figure className="studio-console overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {section.code.language}
              </span>
            </div>
            <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
              <code>{section.code.snippet}</code>
            </pre>
            {section.code.caption && (
              <figcaption className="border-t border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                {section.code.caption}
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </section>
  );
}

function RealWorldPanel({
  data,
  onWatch,
}: {
  data: LearningLessonResponse['lesson']['realWorld'];
  onWatch: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-400/25">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500/10 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="size-4 text-amber-300" />
          Real-world example: {data.title}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 border-amber-400/40 text-xs text-amber-200 hover:bg-amber-500/10"
          onClick={onWatch}
        >
          <PlayCircle className="size-3.5" />
          Watch animated
        </Button>
      </div>
      <div className="space-y-3 p-4 text-sm leading-relaxed">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">Scenario</p>
          <p className="mt-1 text-foreground/85">{data.scenario}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300/80">Solution</p>
          <p className="mt-1 text-foreground/85">{data.solution}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">Outcome</p>
          <p className="mt-1 text-foreground/85">{data.outcome}</p>
        </div>
      </div>
    </div>
  );
}

export function LessonWorkspace() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params?.lessonId;
  const router = useRouter();

  const [view, setView] = useState<LearningLessonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [justCompletedPath, setJustCompletedPath] = useState(false);
  const [explainerRequest, setExplainerRequest] = useState<ExplainerRequestState | null>(null);
  const [mode, setMode] = useState<LessonMode>('read');

  const playStory = useCallback(
    (focus: ExplainerFocus, question?: string) => {
      if (!lessonId) return;
      setExplainerRequest({ lessonId, focus, question });
    },
    [lessonId],
  );

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      setError(null);
      setJustCompletedPath(false);
      setMode('read');
      setView(await fetchLesson(lessonId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this lesson');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markCompleteAndContinue = useCallback(async () => {
    if (!view || completing) return;
    setCompleting(true);
    try {
      const result = view.completed
        ? { pathCompleted: false }
        : await completeLesson(view.lesson.id);
      if (result.pathCompleted) {
        setJustCompletedPath(true);
        setView((current) =>
          current ? { ...current, completed: true, completedAt: new Date().toISOString() } : current,
        );
        return;
      }
      if (view.nextLessonId) {
        router.push(`/learning/lessons/${view.nextLessonId}`);
      } else {
        router.push(`/learning/modules/${view.moduleId}/quiz`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your progress');
    } finally {
      setCompleting(false);
    }
  }, [completing, router, view]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {error && (
        <div className="mb-4">
          <InlineAlert variant="error">{error}</InlineAlert>
        </div>
      )}

      {loading || !view ? (
        !error && (
          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        )
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/learning/paths/${view.pathId}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {view.pathTitle} · {view.moduleTitle}
            </Link>
            {view.completed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <CheckCircle2 className="size-3" />
                Completed
              </span>
            )}
          </div>

          {justCompletedPath && (
            <div className="mb-4">
              <InlineAlert variant="success">
                Path completed — congratulations! Every lesson and quiz in “{view.pathTitle}” is
                done. <Link className="underline" href={`/learning/paths/${view.pathId}`}>View your badge</Link>.
              </InlineAlert>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article className="min-w-0 space-y-6">
              <header>
                <h1 className="text-2xl font-bold">{view.lesson.title}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">{view.lesson.summary}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {view.lesson.durationMinutes} min
                </p>
              </header>

              {/* Read | Video session switch */}
              <div
                role="tablist"
                aria-label="Lesson format"
                className="inline-flex rounded-lg border border-border/60 bg-secondary/20 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'read'}
                  onClick={() => setMode('read')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    mode === 'read'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <BookOpen className="size-3.5" />
                  Read the lesson
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'video'}
                  onClick={() => setMode('video')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    mode === 'video'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Clapperboard className="size-3.5" />
                  Video session
                </button>
              </div>

              {mode === 'video' ? (
                <VideoSessionBlock
                  lessonId={view.lesson.id}
                  onPlayAnimated={() => playStory('lesson')}
                />
              ) : (
                <>
                  <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Target className="size-4 text-sky-300" />
                      What you&apos;ll learn
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {view.lesson.objectives.map((objective) => (
                        <li key={objective} className="flex gap-2 text-sm text-foreground/85">
                          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-sky-400/70" />
                          {objective}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-6">
                    {view.lesson.sections.map((section) => (
                      <SectionBlock key={section.heading} section={section} />
                    ))}
                  </div>

                  <RealWorldPanel
                    data={view.lesson.realWorld}
                    onWatch={() => playStory('real-world')}
                  />

                  <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <ListChecks className="size-4 text-emerald-300" />
                      Key takeaways
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {view.lesson.keyTakeaways.map((takeaway) => (
                        <li key={takeaway} className="flex gap-2 text-sm text-foreground/85">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400/70" />
                          {takeaway}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Lightbulb className="size-4 text-amber-300" />
                      Official resources
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Deepen this lesson with the official Salesforce material.
                    </p>
                    <div className="mt-3 space-y-2">
                      {view.lesson.resources.map((resource) => (
                        <a
                          key={resource.url}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/20 px-3 py-2.5 transition-colors hover:border-primary/40"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={cn(
                                'rounded-md px-2 py-0.5 text-[10px] font-medium shrink-0',
                                RESOURCE_SOURCE_BADGES[resource.source],
                              )}
                            >
                              {resourceSourceLabel(resource.source)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm">{resource.title}</p>
                              {resource.note && (
                                <p className="truncate text-[11px] text-muted-foreground">{resource.note}</p>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                {view.previousLessonId ? (
                  <Button asChild variant="outline" className="gap-1.5">
                    <Link href={`/learning/lessons/${view.previousLessonId}`}>
                      <ChevronLeft className="size-4" />
                      Previous lesson
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  onClick={() => void markCompleteAndContinue()}
                  loading={completing}
                  className="gap-1.5"
                >
                  {view.completed ? (
                    view.quizNext ? (
                      <>
                        <FileQuestion className="size-4" />
                        Go to module quiz
                      </>
                    ) : (
                      <>
                        Next lesson
                        <ArrowRight className="size-4" />
                      </>
                    )
                  ) : view.quizNext ? (
                    <>
                      <CheckCircle2 className="size-4" />
                      Mark complete &amp; take the quiz
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Mark complete &amp; continue
                    </>
                  )}
                </Button>
              </footer>
            </article>

            <aside className="lg:sticky lg:top-6 h-fit">
              <MentorPanel
                lessonId={view.lesson.id}
                contextKey={view.lesson.id}
                realWorldTitle={view.lesson.realWorld.title}
                onPlayStory={playStory}
                className="lg:max-h-[calc(100vh-6rem)] min-h-[420px]"
              />
            </aside>
          </div>

          <ExplainerDialog request={explainerRequest} onClose={() => setExplainerRequest(null)} />
        </>
      )}
    </div>
  );
}
