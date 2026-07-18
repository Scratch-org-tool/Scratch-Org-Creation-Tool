'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { estimateNarrationMs, type ExplainerFocus, type ExplainerStoryboard } from '@sfcc/shared';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { fetchExplainer } from './learning-api';
import { SceneVisual } from './explainer-visuals';
import { useSpeech } from './use-speech';

const RATES = [1, 1.25, 0.85];

export interface ExplainerRequestState {
  lessonId: string;
  focus: ExplainerFocus;
  question?: string;
}

interface ExplainerDialogProps {
  request: ExplainerRequestState | null;
  onClose: () => void;
}

/**
 * The "visual story" player: an AI-scripted storyboard rendered as animated
 * scenes with spoken narration (browser speech synthesis) and captions.
 */
export function ExplainerDialog({ request, onClose }: ExplainerDialogProps) {
  const open = request !== null;
  const [board, setBoard] = useState<ExplainerStoryboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [rateIndex, setRateIndex] = useState(0);
  const speech = useSpeech();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Autoplay callbacks read fresh state through this ref to avoid stale closures.
  const stateRef = useRef({ playing, sceneIndex, total: 0 });
  stateRef.current = { playing, sceneIndex, total: board?.scenes.length ?? 0 };

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopNarration = useCallback(() => {
    clearTimer();
    speech.cancel();
  }, [clearTimer, speech]);

  // Load the storyboard whenever a new request opens the dialog.
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setBoard(null);
    setError(null);
    setLoading(true);
    setSceneIndex(0);
    setPlaying(true);
    void fetchExplainer(request)
      .then((storyboard) => {
        if (!cancelled) setBoard(storyboard);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to build the visual story');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  const advance = useCallback(() => {
    const { playing: isPlaying, sceneIndex: index, total } = stateRef.current;
    if (!isPlaying) return;
    if (index < total - 1) {
      setSceneIndex(index + 1);
    } else {
      setPlaying(false);
    }
  }, []);

  // Narrate the active scene; advance when narration (or its timer) finishes.
  useEffect(() => {
    if (!open || !board || !playing) {
      stopNarration();
      return;
    }
    const scene = board.scenes[sceneIndex];
    if (!scene) return;
    const rate = RATES[rateIndex]!;
    clearTimer();
    if (voiceOn && speech.supported) {
      let advanced = false;
      const scheduleAdvance = (delay: number) => {
        if (advanced) return;
        advanced = true;
        clearTimer();
        timerRef.current = setTimeout(advance, delay);
      };
      speech.speak(`${scene.title}. ${scene.narration}`, {
        rate,
        onEnd: () => scheduleAdvance(700),
      });
      // Safety net: some engines (headless, muted OS audio) never fire `end`.
      timerRef.current = setTimeout(
        () => scheduleAdvance(0),
        (estimateNarrationMs(scene.narration) / rate) * 2.5,
      );
    } else {
      speech.cancel();
      timerRef.current = setTimeout(advance, estimateNarrationMs(scene.narration) / rate);
    }
    return stopNarration;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, board, sceneIndex, playing, voiceOn, rateIndex]);

  // Full cleanup when the dialog closes.
  useEffect(() => {
    if (!open) stopNarration();
  }, [open, stopNarration]);

  const goTo = useCallback(
    (index: number) => {
      stopNarration();
      setSceneIndex(index);
      setPlaying(true);
    },
    [stopNarration],
  );

  const scene = board?.scenes[sceneIndex] ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          stopNarration();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border/60 bg-violet-500/10 px-5 py-3.5 pr-12">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/20">
            <Clapperboard className="size-4 text-violet-300" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-semibold">
              {board?.title ?? 'Visual story'}
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground">
              Animated explainer with voice narration
              {board && (
                <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-1.5 py-px text-[10px] font-medium text-violet-300">
                  <Sparkles className="size-2.5" />
                  {board.source === 'ai' ? 'AI-directed' : 'Lesson storyboard'}
                </span>
              )}
            </p>
          </div>
        </div>

        {loading && (
          <div className="space-y-4 p-6">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <p className="text-center text-xs text-muted-foreground">
              The AI mentor is directing your visual story…
            </p>
          </div>
        )}

        {error && !loading && (
          <p role="alert" className="m-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {board && scene && !loading && (
          <>
            {/* Scene progress segments */}
            <div className="flex gap-1 px-5 pt-4">
              {board.scenes.map((s, index) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Scene ${index + 1}: ${s.title}`}
                  onClick={() => goTo(index)}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    index < sceneIndex
                      ? 'bg-violet-400/70'
                      : index === sceneIndex
                        ? 'bg-violet-400'
                        : 'bg-secondary/70 hover:bg-secondary',
                  )}
                />
              ))}
            </div>

            {/* Animated scene canvas */}
            <div className="relative mx-5 mt-4 overflow-hidden rounded-xl border border-border/60 bg-[hsl(222,47%,7%)]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 90% at 50% 0%, rgba(167,139,250,0.10), transparent), radial-gradient(ellipse 50% 70% at 90% 100%, rgba(56,189,248,0.08), transparent)',
                }}
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={scene.id}
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -32 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="relative flex min-h-[260px] flex-col items-center justify-center gap-2 p-5"
                >
                  <p className="text-center text-sm font-bold">{scene.title}</p>
                  <SceneVisual visual={scene.visual} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Captions */}
            <div className="mx-5 mt-3 flex min-h-[64px] items-start gap-2.5 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <Volume2
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  speech.speaking ? 'text-violet-300 animate-pulse' : 'text-muted-foreground/60',
                )}
              />
              <p className="text-sm leading-relaxed text-foreground/90">{scene.narration}</p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Restart story"
                  onClick={() => goTo(0)}
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous scene"
                  disabled={sceneIndex === 0}
                  onClick={() => goTo(sceneIndex - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="icon"
                  aria-label={playing ? 'Pause' : 'Play'}
                  onClick={() => {
                    if (playing) {
                      stopNarration();
                      setPlaying(false);
                    } else {
                      setPlaying(true);
                    }
                  }}
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next scene"
                  disabled={sceneIndex >= board.scenes.length - 1}
                  onClick={() => goTo(sceneIndex + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <span className="text-xs tabular-nums text-muted-foreground">
                Scene {sceneIndex + 1} of {board.scenes.length}
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  aria-pressed={voiceOn}
                  onClick={() => setVoiceOn((value) => !value)}
                  title={
                    speech.supported
                      ? 'Toggle voice narration'
                      : 'Voice is not supported by this browser — captions only'
                  }
                >
                  {voiceOn && speech.supported ? (
                    <>
                      <Volume2 className="size-3.5" />
                      Voice on
                    </>
                  ) : (
                    <>
                      <VolumeX className="size-3.5" />
                      Voice off
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs tabular-nums"
                  aria-label="Change narration speed"
                  onClick={() => setRateIndex((value) => (value + 1) % RATES.length)}
                >
                  <Gauge className="size-3.5" />
                  {RATES[rateIndex]}x
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
