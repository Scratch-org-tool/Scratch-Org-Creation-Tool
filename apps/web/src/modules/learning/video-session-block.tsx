'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Check,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Lightbulb,
  ListChecks,
  MousePointerClick,
  PlayCircle,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  VIDEO_SEGMENT_KIND_LABELS,
  formatTimecode,
  videoScriptToMarkdown,
  videoScriptToNarration,
  type LessonVideoScript,
  type VideoSegmentKind,
} from '@sfcc/shared';
import { InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { fetchVideoScript } from './learning-api';
import { useSpeech } from './use-speech';

const KIND_STYLES: Record<VideoSegmentKind, { badge: string; icon: typeof Clapperboard }> = {
  intro: { badge: 'bg-violet-500/15 text-violet-300', icon: Clapperboard },
  concept: { badge: 'bg-sky-500/15 text-sky-300', icon: Lightbulb },
  demo: { badge: 'bg-emerald-500/15 text-emerald-300', icon: MousePointerClick },
  story: { badge: 'bg-amber-500/15 text-amber-300', icon: Briefcase },
  recap: { badge: 'bg-sky-500/15 text-sky-300', icon: ListChecks },
  cta: { badge: 'bg-secondary/70 text-muted-foreground', icon: ArrowRight },
};

function downloadText(filename: string, text: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Video session: the complete, production-ready script of this lesson —
 * timecoded segments with word-for-word narration, on-screen direction, and
 * numbered demo click-paths — playable in-app and exportable to external
 * AI video tools (HeyGen, Synthesia, InVideo, CapCut…).
 */
export function VideoSessionBlock({
  lessonId,
  onPlayAnimated,
}: {
  lessonId: string;
  onPlayAnimated: () => void;
}) {
  const [script, setScript] = useState<LessonVideoScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [readingSegment, setReadingSegment] = useState<string | null>(null);
  const speech = useSpeech();

  useEffect(() => {
    let cancelled = false;
    setScript(null);
    setError(null);
    setLoading(true);
    fetchVideoScript(lessonId)
      .then((result) => {
        if (!cancelled) setScript(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load the video session');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      speech.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    if (!speech.speaking) setReadingSegment(null);
  }, [speech.speaking]);

  const copyScript = useCallback(async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(videoScriptToMarkdown(script));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard unavailable — use the download buttons instead.');
    }
  }, [script]);

  const toggleListen = useCallback(
    (segmentId: string, narration: string) => {
      if (readingSegment === segmentId) {
        speech.cancel();
        setReadingSegment(null);
        return;
      }
      setReadingSegment(segmentId);
      speech.speak(narration, { onEnd: () => setReadingSegment(null) });
    },
    [readingSegment, speech],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error && !script) {
    return <InlineAlert variant="error">{error}</InlineAlert>;
  }
  if (!script) return null;

  let elapsed = 0;
  const timecodes = script.segments.map((segment) => {
    const start = elapsed;
    elapsed += segment.durationSeconds;
    return start;
  });

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="overflow-hidden rounded-xl border border-violet-400/25">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-violet-500/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/20">
              <Clapperboard className="size-4 text-violet-300" />
            </span>
            <div>
              <p className="text-sm font-semibold">Video session script</p>
              <p className="text-[11px] text-muted-foreground">
                ~{Math.max(1, Math.round(script.totalDurationSeconds / 60))} min ·{' '}
                {script.segments.length} segments · {script.audience}
                <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-1.5 py-px text-[10px] font-medium text-violet-300">
                  <Sparkles className="size-2.5" />
                  {script.source === 'ai' ? 'AI-scripted' : 'Curriculum script'}
                </span>
              </p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={onPlayAnimated}>
            <PlayCircle className="size-4" />
            Play animated session
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 bg-card/60 px-4 py-2.5">
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void copyScript()}>
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy full script'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              downloadText(`${script.lessonId}-video-script.md`, videoScriptToMarkdown(script), 'text/markdown')
            }
          >
            <Download className="size-3.5" />
            Production script (.md)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              downloadText(`${script.lessonId}-narration.txt`, videoScriptToNarration(script))
            }
          >
            <FileText className="size-3.5" />
            Narration only (.txt)
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Paste the narration into HeyGen / Synthesia / any avatar tool; the .md carries the
            visual directions and demo click-paths.
          </p>
        </div>
      </div>

      {error && <InlineAlert variant="warning">{error}</InlineAlert>}

      {/* Timecoded segments */}
      <ol className="space-y-3">
        {script.segments.map((segment, index) => {
          const style = KIND_STYLES[segment.kind];
          const Icon = style.icon;
          return (
            <li key={segment.id} className="rounded-xl border border-border/60 bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatTimecode(timecodes[index]!)}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      style.badge,
                    )}
                  >
                    <Icon className="size-3" />
                    {VIDEO_SEGMENT_KIND_LABELS[segment.kind]}
                  </span>
                  <p className="truncate text-sm font-semibold">{segment.title}</p>
                </div>
                {speech.supported && (
                  <button
                    type="button"
                    onClick={() => toggleListen(segment.id, segment.narration)}
                    aria-label={
                      readingSegment === segment.id ? 'Stop narration' : 'Listen to this narration'
                    }
                    className={cn(
                      'flex items-center gap-1 text-[11px] transition-colors',
                      readingSegment === segment.id
                        ? 'text-violet-300'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {readingSegment === segment.id ? (
                      <>
                        <VolumeX className="size-3.5" /> Stop
                      </>
                    ) : (
                      <>
                        <Volume2 className="size-3.5" /> Listen
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">{segment.narration}</p>

              <div className="mt-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  On screen
                </p>
                <p className="mt-0.5 text-xs italic text-foreground/75">{segment.onScreen}</p>
              </div>

              {segment.demoSteps && segment.demoSteps.length > 0 && (
                <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/5 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
                    <MousePointerClick className="size-3" />
                    Screen-capture steps
                  </p>
                  <ol className="mt-1.5 space-y-1 pl-1">
                    {segment.demoSteps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex gap-2 text-xs text-foreground/85">
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-emerald-300/80">
                          {stepIndex + 1}.
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {segment.lowerThird && (
                <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-slate-950/40 px-2 py-1 text-[10px] text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">Lower third</span>
                  {segment.lowerThird}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
