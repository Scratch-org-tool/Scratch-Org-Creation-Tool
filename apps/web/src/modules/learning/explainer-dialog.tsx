'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Captions,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  Gauge,
  Image as ImageIcon,
  Loader2,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DEFAULT_EXPLAINER_STUDIO_VOICE,
  EXPLAINER_STUDIO_VOICE_OPTIONS,
  estimateNarrationMs,
  type ExplainerFocus,
  type ExplainerStoryboard,
  type ExplainerStudioVoice,
} from '@sfcc/shared';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/utils/cn';
import {
  fetchExplainer,
  fetchExplainerImage,
  fetchExplainerSpeech,
  fetchExplainerVideo,
} from './learning-api';
import { SceneVisual } from './explainer-visuals';
import { useSpeech } from './use-speech';

const RATES = [1, 1.15, 0.85];
const STUDIO_VOICE_PREFIX = 'studio:';
const BROWSER_VOICE_PREFIX = 'browser:';

type MediaStatus = 'loading' | 'ready' | 'fallback';
interface SceneMediaState {
  status: MediaStatus;
  url?: string;
  /** MIME type of the generated media ('video/webm', 'image/webp', 'image/png'…). */
  mime?: string;
}

type NarrationStatus = 'idle' | 'preparing' | 'speaking';

export interface ExplainerRequestState {
  lessonId: string;
  focus: ExplainerFocus;
  question?: string;
}

interface ExplainerDialogProps {
  request: ExplainerRequestState | null;
  onClose: () => void;
}

function isMotionMime(mime: string | undefined): boolean {
  return Boolean(
    mime && (mime.startsWith('video/') || mime === 'image/webp' || mime === 'image/gif'),
  );
}

function CompactConcepts({
  scene,
}: {
  scene: ExplainerStoryboard['scenes'][number];
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {scene.visual.items.slice(0, 4).map((item, index) => (
        <motion.span
          key={`${item.label}-${index}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + index * 0.12 }}
          className="rounded-full border border-white/15 bg-slate-950/65 px-2.5 py-1 text-[10px] font-medium text-white/90 shadow-lg backdrop-blur-md"
        >
          {item.label}
        </motion.span>
      ))}
    </div>
  );
}

/**
 * Cinematic visual-story player backed by the self-hosted open-source media
 * stack: generated motion clips → generated still art → animated diagrams,
 * and VibeVoice narration → device voices → timed captions.
 */
export function ExplainerDialog({ request, onClose }: ExplainerDialogProps) {
  const open = request !== null;
  const [board, setBoard] = useState<ExplainerStoryboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [rateIndex, setRateIndex] = useState(0);
  const [voiceChoice, setVoiceChoice] = useState(
    `${STUDIO_VOICE_PREFIX}${DEFAULT_EXPLAINER_STUDIO_VOICE}`,
  );
  const [mediaStates, setMediaStates] = useState<Record<string, SceneMediaState>>({});
  const [narrationStatus, setNarrationStatus] = useState<NarrationStatus>('idle');
  const speech = useSpeech();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStatesRef = useRef(new Map<string, SceneMediaState>());
  const audioUrlsRef = useRef(new Map<string, string>());
  const playbackTokenRef = useRef(0);
  const stateRef = useRef({ playing, sceneIndex, total: 0 });
  stateRef.current = { playing, sceneIndex, total: board?.scenes.length ?? 0 };

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopNarration = useCallback(() => {
    playbackTokenRef.current += 1;
    clearTimer();
    speech.cancel();
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, [clearTimer, speech.cancel]);

  const releaseGeneratedMedia = useCallback(() => {
    for (const state of mediaStatesRef.current.values()) {
      if (state.url) URL.revokeObjectURL(state.url);
    }
    for (const url of audioUrlsRef.current.values()) URL.revokeObjectURL(url);
    mediaStatesRef.current.clear();
    audioUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      stopNarration();
      releaseGeneratedMedia();
    };
  }, [releaseGeneratedMedia, stopNarration]);

  // Load a fresh script whenever the learner launches a story or asks a question.
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    stopNarration();
    releaseGeneratedMedia();
    setMediaStates({});
    setBoard(null);
    setError(null);
    setLoading(true);
    setSceneIndex(0);
    setPlaying(true);
    setNarrationStatus('idle');

    void fetchExplainer(request)
      .then((storyboard) => {
        if (cancelled) return;
        setBoard(storyboard);
        setVoiceChoice(
          storyboard.media.generatedSpeech
            ? `${STUDIO_VOICE_PREFIX}${DEFAULT_EXPLAINER_STUDIO_VOICE}`
            : `${BROWSER_VOICE_PREFIX}default`,
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to direct this story');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [releaseGeneratedMedia, request, stopNarration]);

  const advance = useCallback(() => {
    const { playing: isPlaying, sceneIndex: index, total } = stateRef.current;
    if (!isPlaying) return;
    if (index < total - 1) {
      setSceneIndex(index + 1);
    } else {
      setPlaying(false);
      setNarrationStatus('idle');
    }
  }, []);

  // Best media wins: motion clip → still art → animated diagram fallback.
  const loadSceneMedia = useCallback(
    async (sceneId: string, signal: AbortSignal) => {
      if (!request || !board) return;
      const wantsVideo = board.media.generatedVideo;
      const wantsImage = board.media.generatedImages;
      if (!wantsVideo && !wantsImage) return;
      const existing = mediaStatesRef.current.get(sceneId);
      if (existing?.status === 'ready' || existing?.status === 'loading') return;

      const setState = (state: SceneMediaState) => {
        mediaStatesRef.current.set(sceneId, state);
        setMediaStates((current) => ({ ...current, [sceneId]: state }));
      };
      setState({ status: 'loading' });

      const attempt = async (
        kind: 'video' | 'image',
      ): Promise<SceneMediaState | null> => {
        try {
          const blob =
            kind === 'video'
              ? await fetchExplainerVideo({ ...request, sceneId }, signal)
              : await fetchExplainerImage({ ...request, sceneId }, signal);
          if (blob.size < 64) return null;
          const expected =
            kind === 'video' ? isMotionMime(blob.type) : blob.type.startsWith('image/');
          if (!expected) return null;
          return { status: 'ready', url: URL.createObjectURL(blob), mime: blob.type };
        } catch {
          return null;
        }
      };

      let ready: SceneMediaState | null = null;
      if (wantsVideo) ready = await attempt('video');
      if (!ready && !signal.aborted && wantsImage) ready = await attempt('image');

      if (signal.aborted) {
        mediaStatesRef.current.delete(sceneId);
        return;
      }
      setState(ready ?? { status: 'fallback' });
    },
    [board, request],
  );

  // Generate the active scene's media first, then quietly prepare the next scene.
  useEffect(() => {
    if (!board || (!board.media.generatedVideo && !board.media.generatedImages)) return;
    const active = board.scenes[sceneIndex];
    if (!active) return;
    const controller = new AbortController();
    void loadSceneMedia(active.id, controller.signal).then(() => {
      const next = board.scenes[sceneIndex + 1];
      if (next && !controller.signal.aborted) {
        void loadSceneMedia(next.id, controller.signal);
      }
    });
    return () => controller.abort();
  }, [board, loadSceneMedia, sceneIndex]);

  const scheduleAdvance = useCallback(
    (token: number, delay = 650) => {
      if (playbackTokenRef.current !== token) return;
      clearTimer();
      timerRef.current = setTimeout(advance, delay);
    },
    [advance, clearTimer],
  );

  // Narration is generated scene-by-scene. Any provider/browser failure drops
  // cleanly to the local speech engine, then to timed captions.
  useEffect(() => {
    if (!open || !board || !playing) {
      stopNarration();
      setNarrationStatus('idle');
      return;
    }
    const scene = board.scenes[sceneIndex];
    if (!scene || !request) return;
    stopNarration();
    const token = playbackTokenRef.current;
    const rate = RATES[rateIndex]!;
    const controller = new AbortController();

    const browserFallback = () => {
      if (controller.signal.aborted || playbackTokenRef.current !== token) return;
      if (voiceOn && speech.supported) {
        setNarrationStatus('speaking');
        const browserVoiceId = voiceChoice.startsWith(BROWSER_VOICE_PREFIX)
          ? voiceChoice.slice(BROWSER_VOICE_PREFIX.length)
          : undefined;
        speech.speak(scene.narration, {
          rate,
          voiceId: browserVoiceId === 'default' ? undefined : browserVoiceId,
          onEnd: () => scheduleAdvance(token),
        });
        timerRef.current = setTimeout(
          () => scheduleAdvance(token, 0),
          (estimateNarrationMs(scene.narration) / rate) * 2.5,
        );
      } else {
        setNarrationStatus('idle');
        timerRef.current = setTimeout(
          () => scheduleAdvance(token, 0),
          estimateNarrationMs(scene.narration) / rate,
        );
      }
    };

    const useStudioVoice =
      voiceOn &&
      board.media.generatedSpeech &&
      voiceChoice.startsWith(STUDIO_VOICE_PREFIX);
    if (!useStudioVoice) {
      browserFallback();
      return () => {
        controller.abort();
        stopNarration();
      };
    }

    const voice = voiceChoice.slice(STUDIO_VOICE_PREFIX.length) as ExplainerStudioVoice;
    const audioKey = `${scene.id}|${voice}`;
    const playGeneratedAudio = async () => {
      setNarrationStatus('preparing');
      try {
        let url = audioUrlsRef.current.get(audioKey);
        if (!url) {
          const blob = await fetchExplainerSpeech(
            { ...request, sceneId: scene.id, voice },
            controller.signal,
          );
          if (blob.size < 64 || !blob.type.startsWith('audio/')) {
            throw new Error('No generated narration');
          }
          url = URL.createObjectURL(blob);
          audioUrlsRef.current.set(audioKey, url);
        }
        if (controller.signal.aborted || playbackTokenRef.current !== token) return;
        const audio = new Audio(url);
        audio.playbackRate = rate;
        audioRef.current = audio;
        audio.onended = () => scheduleAdvance(token);
        audio.onerror = browserFallback;
        setNarrationStatus('speaking');
        await audio.play();
        timerRef.current = setTimeout(
          () => scheduleAdvance(token, 0),
          (estimateNarrationMs(scene.narration) / rate) * 3.5,
        );
      } catch {
        browserFallback();
      }
    };
    void playGeneratedAudio();

    return () => {
      controller.abort();
      stopNarration();
    };
    // The speech controller methods are stable; speaking/voice-list updates
    // must not restart an active scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    board,
    sceneIndex,
    playing,
    voiceOn,
    voiceChoice,
    rateIndex,
    request,
    scheduleAdvance,
    stopNarration,
  ]);

  useEffect(() => {
    if (!open) {
      stopNarration();
      setNarrationStatus('idle');
    }
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
  const sceneMedia = scene ? mediaStates[scene.id] : undefined;
  const hasGeneratedMedia = sceneMedia?.status === 'ready' && Boolean(sceneMedia.url);
  const isMotionScene = hasGeneratedMedia && isMotionMime(sceneMedia?.mime);
  const activeVoiceValue = useMemo(() => {
    if (voiceChoice.startsWith(STUDIO_VOICE_PREFIX) && !board?.media.generatedSpeech) {
      return `${BROWSER_VOICE_PREFIX}default`;
    }
    return voiceChoice;
  }, [board?.media.generatedSpeech, voiceChoice]);
  const unreachableTiers = useMemo(() => {
    if (!board) return [] as string[];
    const labels: Record<string, string> = {
      video: 'motion (ComfyUI)',
      images: 'images (Stable Diffusion)',
      speech: 'voice (VibeVoice)',
    };
    return Object.entries(board.media.status)
      .filter(([, status]) => status === 'unreachable')
      .map(([tier]) => labels[tier] ?? tier);
  }, [board]);
  const mediaFullyOff =
    Boolean(board) &&
    !board!.media.generatedVideo &&
    !board!.media.generatedImages &&
    !board!.media.generatedSpeech;

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
      <DialogContent className="max-h-[94vh] max-w-5xl gap-0 overflow-y-auto p-0">
        <div className="flex items-center gap-2.5 border-b border-border/60 bg-violet-500/10 px-5 py-3.5 pr-12">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/20">
            <Clapperboard className="size-4 text-violet-300" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm font-semibold">
              {board?.title ?? 'Directing your concept story'}
            </DialogTitle>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>Listen, watch, then recall</span>
              {board && (
                <>
                  <span className="rounded-full bg-violet-500/15 px-1.5 py-px font-medium text-violet-300">
                    {board.source === 'ai' ? 'AI-directed' : 'Lesson-grounded'}
                  </span>
                  {board.media.generatedVideo && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-px font-medium text-sky-300">
                      <Film className="size-2.5" />
                      Motion scenes
                    </span>
                  )}
                  {!board.media.generatedVideo && board.media.generatedImages && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-px font-medium text-sky-300">
                      <ImageIcon className="size-2.5" />
                      Scene art
                    </span>
                  )}
                  {board.media.generatedSpeech && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-px font-medium text-emerald-300">
                      <Mic2 className="size-2.5" />
                      VibeVoice narration
                    </span>
                  )}
                  {unreachableTiers.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-px font-medium text-amber-300"
                      title={`Configured but not answering: ${unreachableTiers.join(', ')}. Check the server URLs in apps/api/.env and see docs/academy-open-media-plan.md.`}
                    >
                      <AlertTriangle className="size-2.5" />
                      Media studio unreachable
                    </span>
                  )}
                  {mediaFullyOff && unreachableTiers.length === 0 && (
                    <span
                      className="rounded-full bg-secondary/70 px-1.5 py-px font-medium text-muted-foreground"
                      title="No media servers connected — set VIBEVOICE_BASE_URL, SD_WEBUI_BASE_URL, and/or COMFYUI_BASE_URL (docs/academy-open-media-plan.md). Stories keep working with built-in visuals and your device voice."
                    >
                      Built-in visuals · device voice
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="space-y-4 p-6">
            <Skeleton className="aspect-video w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <p className="text-center text-xs text-muted-foreground">
              Building the mental movie for this concept…
            </p>
          </div>
        )}

        {error && !loading && (
          <p
            role="alert"
            className="m-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {board && scene && !loading && (
          <>
            <div className="flex gap-1 px-5 pt-4">
              {board.scenes.map((candidate, index) => (
                <button
                  key={candidate.id}
                  type="button"
                  aria-label={`Scene ${index + 1}: ${candidate.title}`}
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

            <div className="relative mx-5 mt-4 aspect-video min-h-[300px] overflow-hidden rounded-2xl border border-border/60 bg-[hsl(222,47%,7%)] shadow-2xl shadow-violet-950/20">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 90% at 50% 0%, rgba(167,139,250,0.13), transparent), radial-gradient(ellipse 50% 70% at 90% 100%, rgba(56,189,248,0.10), transparent)',
                }}
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={scene.id}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="absolute inset-0"
                >
                  {hasGeneratedMedia ? (
                    <>
                      {sceneMedia?.mime?.startsWith('video/') ? (
                        <motion.video
                          src={sceneMedia.url}
                          aria-label={`Generated motion scene for ${scene.title}`}
                          className="size-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.6 }}
                        />
                      ) : (
                        <motion.img
                          src={sceneMedia?.url}
                          alt={`Generated scene for ${scene.title}`}
                          className="size-full object-cover"
                          initial={
                            isMotionScene
                              ? { opacity: 0 }
                              : { scale: 1.06, opacity: 0 }
                          }
                          animate={isMotionScene ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                          transition={
                            isMotionScene
                              ? { duration: 0.6 }
                              : { scale: { duration: 10, ease: 'linear' }, opacity: { duration: 0.6 } }
                          }
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/5 to-slate-950/35" />
                      <div className="absolute inset-x-4 bottom-4">
                        <CompactConcepts scene={scene} />
                      </div>
                    </>
                  ) : (
                    <div className="relative flex size-full flex-col items-center justify-center gap-2 p-5">
                      <SceneVisual visual={scene.visual} />
                    </div>
                  )}

                  <div className="absolute left-4 top-4 max-w-[78%] rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 shadow-lg backdrop-blur-md">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-200/80">
                      Scene {sceneIndex + 1}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-white">{scene.title}</p>
                  </div>

                  {sceneMedia?.status === 'loading' && (
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1 text-[10px] text-white/75 backdrop-blur-md">
                      <Loader2 className="size-3 animate-spin" />
                      {board.media.generatedVideo ? 'Creating scene motion' : 'Creating scene art'}
                    </span>
                  )}
                  {hasGeneratedMedia && (
                    <span className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1 text-[9px] text-white/65 backdrop-blur-md">
                      {isMotionScene ? 'AI-generated motion scene' : 'AI-generated concept art'}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {captionsOn && (
              <div
                aria-live="polite"
                className="mx-5 mt-3 flex min-h-[62px] items-start gap-2.5 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3"
              >
                {narrationStatus === 'preparing' ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-violet-300" />
                ) : (
                  <Volume2
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      narrationStatus === 'speaking'
                        ? 'animate-pulse text-violet-300'
                        : 'text-muted-foreground/60',
                    )}
                  />
                )}
                <div>
                  {narrationStatus === 'preparing' && (
                    <p className="mb-0.5 text-[10px] font-medium text-violet-300">
                      Preparing your selected narrator…
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-foreground/90">{scene.narration}</p>
                </div>
              </div>
            )}

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
                    } else if (sceneIndex >= board.scenes.length - 1) {
                      goTo(0);
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
                {sceneIndex + 1} / {board.scenes.length}
              </span>

              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Select
                  value={activeVoiceValue}
                  onValueChange={(value) => {
                    stopNarration();
                    setVoiceChoice(value);
                    if (value.startsWith(BROWSER_VOICE_PREFIX)) {
                      const id = value.slice(BROWSER_VOICE_PREFIX.length);
                      if (id !== 'default') speech.selectVoice(id);
                    }
                  }}
                  disabled={!voiceOn}
                >
                  <SelectTrigger className="h-8 w-[178px] gap-1.5 text-xs" aria-label="Narrator voice">
                    <Mic2 className="size-3.5 shrink-0 text-violet-300" />
                    <SelectValue placeholder="Narrator voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {board.media.generatedSpeech ? (
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Studio voices (VibeVoice)
                        </SelectLabel>
                        {EXPLAINER_STUDIO_VOICE_OPTIONS.map((voice) => (
                          <SelectItem
                            key={voice.id}
                            value={`${STUDIO_VOICE_PREFIX}${voice.id}`}
                            className="text-xs"
                          >
                            {voice.label} · {voice.tone}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : (
                      <SelectGroup>
                        <SelectLabel className="max-w-[220px] whitespace-normal text-[10px] font-normal normal-case leading-snug text-amber-300/90">
                          {board.media.status.speech === 'unreachable'
                            ? 'VibeVoice server is not answering — using your device voices below.'
                            : 'VibeVoice is not connected — using your device voices below.'}
                        </SelectLabel>
                      </SelectGroup>
                    )}
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Device voices
                      </SelectLabel>
                      <SelectItem value={`${BROWSER_VOICE_PREFIX}default`} className="text-xs">
                        Best available
                      </SelectItem>
                      {speech.voices.map((voice) => (
                        <SelectItem
                          key={voice.id}
                          value={`${BROWSER_VOICE_PREFIX}${voice.id}`}
                          className="text-xs"
                        >
                          {voice.name} · {voice.language}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs"
                  aria-pressed={voiceOn}
                  onClick={() => setVoiceOn((value) => !value)}
                  title="Toggle narration"
                >
                  {voiceOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                  <span className="sr-only">{voiceOn ? 'Voice on' : 'Voice off'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs"
                  aria-pressed={captionsOn}
                  onClick={() => setCaptionsOn((value) => !value)}
                  title="Toggle captions"
                >
                  <Captions className="size-3.5" />
                  <span className="sr-only">Toggle captions</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs tabular-nums"
                  aria-label="Change narration speed"
                  onClick={() => setRateIndex((value) => (value + 1) % RATES.length)}
                >
                  <Gauge className="size-3.5" />
                  {RATES[rateIndex]}x
                </Button>
              </div>
            </div>

            <p className="-mt-1 px-5 pb-4 text-center text-[9px] text-muted-foreground">
              Generated scenes are conceptual aids; lesson content remains the source of truth.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
