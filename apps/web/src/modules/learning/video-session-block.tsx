'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Clock, Loader2, PlayCircle, User, Video } from 'lucide-react';
import { formatVideoSize, type LearningLessonVideoView } from '@sfcc/shared';
import { InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchLessonVideoBlob, fetchLessonVideos } from './learning-api';
import { formatDate } from './learning-ui';

/**
 * Video sessions: real training videos published by an administrator for this
 * lesson (managed from Academy Progress → Lesson video sessions). This block
 * is watch-only — learners stream the videos inline and nothing else.
 */
export function VideoSessionBlock({ lessonId }: { lessonId: string }) {
  const [videos, setVideos] = useState<LearningLessonVideoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback: one active video at a time, streamed with auth then played
  // from an object URL (so the <video> tag needs no credentials).
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const releasePlayback = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlayingId(null);
    setPlayingUrl(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    releasePlayback();
    fetchLessonVideos(lessonId)
      .then((list) => {
        if (!cancelled) setVideos(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load video sessions');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      releasePlayback();
    };
  }, [lessonId, releasePlayback]);

  const play = useCallback(
    async (video: LearningLessonVideoView) => {
      if (playingId === video.id || preparingId) return;
      setPreparingId(video.id);
      setError(null);
      try {
        const blob = await fetchLessonVideoBlob(video.id);
        releasePlayback();
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setPlayingId(video.id);
        setPlayingUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load this video');
      } finally {
        setPreparingId(null);
      }
    },
    [playingId, preparingId, releasePlayback],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {videos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 px-6 py-10 text-center">
          <Video className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">No video sessions yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Videos for this lesson have not been published yet. Switch to “Read the lesson” in
            the meantime.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {videos.map((video) => (
            <li key={video.id} className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
                    <Clapperboard className="size-4 text-violet-300" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{video.title}</p>
                    <p className="flex flex-wrap items-center gap-x-2.5 text-[11px] text-muted-foreground">
                      <span>{formatVideoSize(video.sizeBytes)}</span>
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" />
                        {video.uploadedByName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(video.createdAt)}
                      </span>
                    </p>
                  </div>
                </div>
                {playingId !== video.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    disabled={preparingId !== null}
                    onClick={() => void play(video)}
                  >
                    {preparingId === video.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="size-3.5" />
                    )}
                    Watch
                  </Button>
                )}
              </div>

              {playingId === video.id && playingUrl && (
                <div className="border-t border-border/60 bg-[hsl(222,47%,6%)]">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={playingUrl}
                    controls
                    autoPlay
                    playsInline
                    className="aspect-video w-full"
                    aria-label={`Video session: ${video.title}`}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
