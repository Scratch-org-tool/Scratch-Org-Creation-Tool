'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  FileQuestion,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Breadcrumbs, InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { startQuiz, submitQuiz } from './learning-api';
import { learningCrumbs, learningQuizCrumbs } from './learning-breadcrumbs';
import { ProgressRing } from './progress-ring';
import type { LearningQuizAttemptView, LearningQuizResult } from './types';

type Stage = 'loading' | 'quiz' | 'submitting' | 'result' | 'error';

function OptionButton({
  option,
  index,
  selected,
  onSelect,
}: {
  option: string;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all sm:gap-3 sm:px-4 sm:py-3',
        selected
          ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10'
          : 'border-border/60 bg-secondary/20 hover:border-primary/40',
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold',
          selected ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-muted-foreground',
        )}
      >
        {letters[index] ?? index + 1}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-relaxed">{option}</span>
    </button>
  );
}

function ReviewCard({ item, index }: { item: LearningQuizResult['review'][number]; index: number }) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        item.correct ? 'border-emerald-400/25 bg-emerald-500/5' : 'border-red-400/25 bg-red-500/5',
      )}
    >
      <div className="flex items-start gap-2.5">
        {item.correct ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
        ) : (
          <XCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {index + 1}. {item.prompt}
          </p>
          {item.topic && (
            <span className="mt-1 inline-block rounded-full bg-secondary/50 px-2 py-px text-[10px] text-muted-foreground">
              {item.topic}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-1.5 pl-6">
        {item.options.map((option, optionIndex) => {
          const isCorrect = optionIndex === item.correctIndex;
          const isSelected = optionIndex === item.selectedIndex;
          return (
            <div
              key={optionIndex}
              className={cn(
                'flex flex-col gap-1 rounded-lg border px-3 py-1.5 text-xs sm:flex-row sm:items-start sm:gap-2',
                isCorrect
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                  : isSelected
                    ? 'border-red-400/40 bg-red-500/10 text-red-200'
                    : 'border-transparent text-muted-foreground',
              )}
            >
              <div className="flex min-w-0 items-start gap-2">
                <span className="shrink-0 font-bold">{letters[optionIndex] ?? optionIndex + 1}.</span>
                <span className="min-w-0 flex-1">{option}</span>
              </div>
              {isCorrect && <span className="shrink-0 font-medium sm:ml-auto">Correct</span>}
              {isSelected && !isCorrect && (
                <span className="shrink-0 font-medium sm:ml-auto">Your answer</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 ml-0 rounded-lg bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-foreground/80 sm:ml-6">
        {item.explanation}
      </p>
    </div>
  );
}

export function QuizWorkspace() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params?.moduleId;

  const [stage, setStage] = useState<Stage>('loading');
  const [attempt, setAttempt] = useState<LearningQuizAttemptView | null>(null);
  const [result, setResult] = useState<LearningQuizResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const begin = useCallback(async () => {
    if (!moduleId) return;
    setStage('loading');
    setResult(null);
    setAnswers({});
    setCurrent(0);
    try {
      setError(null);
      const view = await startQuiz(moduleId);
      setAttempt(view);
      setStage('quiz');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start the quiz');
      setStage('error');
    }
  }, [moduleId]);

  useEffect(() => {
    void begin();
  }, [begin]);

  const answeredCount = useMemo(
    () => (attempt ? attempt.questions.filter((q) => answers[q.id] !== undefined).length : 0),
    [answers, attempt],
  );

  const submit = useCallback(async () => {
    if (!attempt) return;
    setStage('submitting');
    try {
      setError(null);
      const submission = attempt.questions.map((question) => ({
        questionId: question.id,
        selectedIndex: answers[question.id] ?? null,
      }));
      const quizResult = await submitQuiz(attempt.id, submission);
      setResult(quizResult);
      setStage('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit the quiz');
      setStage('quiz');
    }
  }, [answers, attempt]);

  const question = attempt?.questions[current];

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:space-y-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <Breadcrumbs
          className="w-full min-w-0"
          items={
            attempt
              ? learningQuizCrumbs(
                  attempt.pathId,
                  attempt.pathTitle ?? 'Training path',
                  attempt.moduleId,
                  attempt.moduleTitle,
                )
              : moduleId
                ? learningCrumbs({
                    href: `/learning/modules/${moduleId}/quiz`,
                    label: 'Module quiz',
                  })
                : learningCrumbs()
          }
        />
        {attempt && stage !== 'result' && (
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 self-start rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-300">
            <Sparkles className="size-3" />
            <span className="hidden min-[400px]:inline">
              {attempt.source === 'static' ? 'Curated question set' : 'AI-generated questions'}
            </span>
          </span>
        )}
      </div>

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {stage === 'loading' && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <p className="text-center text-xs text-muted-foreground">
            Preparing your quiz — the AI is drafting fresh questions…
          </p>
        </div>
      )}

      {stage === 'error' && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t start this quiz. If you just updated the app, wait a moment for the API
            to finish restarting and try again.
          </p>
          <Button onClick={() => void begin()}>Try again</Button>
        </div>
      )}

      {(stage === 'quiz' || stage === 'submitting') && attempt && question && (
        <>
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <p className="flex items-start gap-2 text-sm font-semibold leading-snug">
                  <FileQuestion className="mt-0.5 size-4 shrink-0 text-sky-300" />
                  <span className="min-w-0">{attempt.moduleTitle} — module quiz</span>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:mt-0.5">
                  {attempt.questionCount} questions · pass at {attempt.passPercent}% · instant
                  scoring with explanations
                </p>
              </div>
              <span className="w-fit shrink-0 self-start rounded-lg bg-secondary/50 px-3 py-1.5 text-xs font-semibold tabular-nums">
                {current + 1} / {attempt.questionCount}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-400 transition-all duration-300"
                style={{ width: `${(answeredCount / attempt.questionCount) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-4 sm:p-5">
            {question.topic && (
              <span className="mb-2 inline-block rounded-full bg-secondary/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {question.topic}
              </span>
            )}
            <h2 className="text-base font-semibold leading-relaxed">{question.prompt}</h2>
            <div className="mt-4 space-y-2">
              {question.options.map((option, index) => (
                <OptionButton
                  key={index}
                  option={option}
                  index={index}
                  selected={answers[question.id] === index}
                  onSelect={() =>
                    setAnswers((current_) => ({ ...current_, [question.id]: index }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-center gap-1.5 overflow-x-auto px-1 py-0.5 scrollbar-thin">
              {attempt.questions.map((q, index) => (
                <button
                  key={q.id}
                  type="button"
                  aria-label={`Go to question ${index + 1}`}
                  onClick={() => setCurrent(index)}
                  className={cn(
                    'size-2.5 shrink-0 rounded-full transition-colors',
                    index === current
                      ? 'bg-primary'
                      : answers[q.id] !== undefined
                        ? 'bg-primary/40'
                        : 'bg-secondary/70',
                  )}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
              <Button
                variant="outline"
                className="w-full gap-1.5 sm:w-auto"
                disabled={current === 0 || stage === 'submitting'}
                onClick={() => setCurrent((value) => Math.max(0, value - 1))}
              >
                <ChevronLeft className="size-4" />
                <span className="hidden min-[400px]:inline">Previous</span>
                <span className="min-[400px]:hidden">Prev</span>
              </Button>
              {current < attempt.questionCount - 1 ? (
                <Button
                  className="w-full gap-1.5 sm:w-auto"
                  disabled={stage === 'submitting'}
                  onClick={() => setCurrent((value) => Math.min(attempt.questionCount - 1, value + 1))}
                >
                  Next
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  className="w-full gap-1.5 sm:w-auto"
                  loading={stage === 'submitting'}
                  disabled={answeredCount < attempt.questionCount}
                  title={
                    answeredCount < attempt.questionCount
                      ? `Answer all questions (${answeredCount}/${attempt.questionCount})`
                      : undefined
                  }
                  onClick={() => void submit()}
                >
                  <CheckCircle2 className="size-4" />
                  Submit
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {stage === 'result' && result && (
        <>
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border p-4 text-center sm:p-6',
              result.passed ? 'border-emerald-400/30' : 'border-amber-400/30',
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                background: result.passed
                  ? 'radial-gradient(ellipse 70% 90% at 50% 0%, rgba(52,211,153,0.15), transparent)'
                  : 'radial-gradient(ellipse 70% 90% at 50% 0%, rgba(251,191,36,0.12), transparent)',
              }}
            />
            <div className="relative flex flex-col items-center gap-3">
              <ProgressRing
                percent={result.scorePercent}
                size={110}
                strokeWidth={9}
                accent={result.passed ? '#34d399' : '#fbbf24'}
                label={`Quiz score ${result.scorePercent}%`}
              />
              <div>
                <p className="flex items-center justify-center gap-2 text-lg font-bold">
                  {result.passed ? (
                    <>
                      <Trophy className="size-5 text-emerald-300" />
                      Quiz passed
                    </>
                  ) : (
                    'Not quite there yet'
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.correctCount} of {result.totalQuestions} correct · pass mark{' '}
                  {result.passPercent}%
                </p>
              </div>
              {result.moduleCompleted && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="size-3.5" />
                  Module completed
                </span>
              )}
              {result.pathCompleted && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">
                  <Award className="size-3.5" />
                  Path completed — badge earned!
                </span>
              )}
              <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                {result.coaching}
              </p>
              <div className="mt-1 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                {!result.passed && (
                  <Button onClick={() => void begin()} className="w-full gap-1.5 sm:w-auto">
                    <RotateCcw className="size-4" />
                    Retake quiz
                  </Button>
                )}
                <Button
                  asChild
                  variant={result.passed ? 'default' : 'outline'}
                  className="w-full gap-1.5 sm:w-auto"
                >
                  <Link href={`/learning/paths/${result.pathId}`}>
                    {result.passed ? 'Continue the path' : 'Review the lessons'}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Answer review</h3>
            <div className="space-y-3">
              {result.review.map((item, index) => (
                <ReviewCard key={item.questionId} item={item} index={index} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
