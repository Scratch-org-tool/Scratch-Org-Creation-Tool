'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
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
import { InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { startQuiz, submitQuiz } from './learning-api';
import { ProgressRing } from './progress-ring';
import type { LearningQuizAttemptView, LearningQuizResult } from './types';

type Stage = 'loading' | 'quiz' | 'submitting' | 'result';

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
        'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all',
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
      <span className="text-sm leading-relaxed">{option}</span>
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
                'flex items-start gap-2 rounded-lg border px-3 py-1.5 text-xs',
                isCorrect
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                  : isSelected
                    ? 'border-red-400/40 bg-red-500/10 text-red-200'
                    : 'border-transparent text-muted-foreground',
              )}
            >
              <span className="font-bold">{letters[optionIndex] ?? optionIndex + 1}.</span>
              <span>{option}</span>
              {isCorrect && <span className="ml-auto shrink-0 font-medium">Correct</span>}
              {isSelected && !isCorrect && (
                <span className="ml-auto shrink-0 font-medium">Your answer</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 rounded-lg bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-foreground/80 ml-6">
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
      setStage('quiz');
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={attempt ? `/learning/paths/${attempt.pathId}` : '/learning'}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {attempt ? `Back to path` : 'Salesforce Academy'}
        </Link>
        {attempt && stage !== 'result' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-300">
            <Sparkles className="size-3" />
            {attempt.source === 'static' ? 'Curated question set' : 'AI-generated questions'}
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

      {(stage === 'quiz' || stage === 'submitting') && attempt && question && (
        <>
          <div className="rounded-xl border border-border/60 bg-card/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <FileQuestion className="size-4 text-sky-300" />
                  {attempt.moduleTitle} — module quiz
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {attempt.questionCount} questions · pass at {attempt.passPercent}% · instant
                  scoring with explanations
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-secondary/50 px-3 py-1.5 text-xs font-semibold tabular-nums">
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

          <div className="rounded-xl border border-border/60 bg-card/60 p-5">
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

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={current === 0 || stage === 'submitting'}
              onClick={() => setCurrent((value) => Math.max(0, value - 1))}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1.5">
              {attempt.questions.map((q, index) => (
                <button
                  key={q.id}
                  type="button"
                  aria-label={`Go to question ${index + 1}`}
                  onClick={() => setCurrent(index)}
                  className={cn(
                    'size-2.5 rounded-full transition-colors',
                    index === current
                      ? 'bg-primary'
                      : answers[q.id] !== undefined
                        ? 'bg-primary/40'
                        : 'bg-secondary/70',
                  )}
                />
              ))}
            </div>
            {current < attempt.questionCount - 1 ? (
              <Button
                className="gap-1.5"
                disabled={stage === 'submitting'}
                onClick={() => setCurrent((value) => Math.min(attempt.questionCount - 1, value + 1))}
              >
                Next
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                className="gap-1.5"
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
                Submit quiz
              </Button>
            )}
          </div>
        </>
      )}

      {stage === 'result' && result && (
        <>
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border p-6 text-center',
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
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                {!result.passed && (
                  <Button onClick={() => void begin()} className="gap-1.5">
                    <RotateCcw className="size-4" />
                    Retake quiz
                  </Button>
                )}
                <Button asChild variant={result.passed ? 'default' : 'outline'} className="gap-1.5">
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
