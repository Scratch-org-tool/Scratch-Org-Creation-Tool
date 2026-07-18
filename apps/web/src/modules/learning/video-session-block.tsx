'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  Clock,
  Loader2,
  PlayCircle,
  Trash2,
  Upload,
  User,
  Video,
} from 'lucide-react';
import { formatVideoSize, type LearningLessonVideoView } from '@sfcc/shared';
import { useAuth } from '@/contexts/auth-context';
import { InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  deleteLessonVideo,
  fetchLessonVideoBlob,
  fetchLessonVideos,
  uploadLessonVideo,
} from './learning-api';
import { formatDate } from './learning-ui';

/**
 * Video sessions: real videos uploaded by an administrator for this lesson.
 * Learners watch them inline; admins get an upload panel and per-video delete.
 */
export function VideoSessionBlock({ lessonId }: { lessonId: string }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [videos, setVideos] = useState<LearningLessonVideoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback: one active video at a time, streamed with auth then played
  // from an object URL (so the <video> tag needs no credentials).
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Admin upload state.
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const submitUpload = useCallback(async () => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const created = await uploadLessonVideo(lessonId, file, title);
      setVideos((current) => [...current, created]);
      setFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [file, lessonId, title, uploading]);

  const remove = useCallback(
    async (videoId: string) => {
      if (deletingId) return;
      setDeletingId(videoId);
      setError(null);
      try {
        await deleteLessonVideo(videoId);
        setVideos((current) => current.filter((video) => video.id !== videoId));
        if (playingId === videoId) releasePlayback();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete this video');
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId, playingId, releasePlayback],
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

      {isAdmin && (
        <div className="rounded-xl border border-violet-400/25 bg-violet-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="size-4 text-violet-300" />
            Upload a video session
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            MP4, WebM, OGG, MOV, MKV, or AVI. Learners on this lesson see it immediately.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,video/x-msvideo"
              aria-label="Choose a video file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary/70 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary"
            />
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title (optional — defaults to the file name)"
              maxLength={120}
              className="h-8 text-xs sm:max-w-xs"
            />
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={!file || uploading}
              loading={uploading}
              onClick={() => void submitUpload()}
            >
              <Upload className="size-3.5" />
              Upload
            </Button>
          </div>
          {file && !uploading && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Ready: {file.name} · {formatVideoSize(file.size)}
            </p>
          )}
          {uploadError && (
            <p role="alert" className="mt-2 text-[11px] text-destructive">
              {uploadError}
            </p>
          )}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 px-6 py-10 text-center">
          <Video className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">No video sessions yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {isAdmin
              ? 'Upload the first video for this lesson above — it appears here for every learner.'
              : 'Your administrator has not uploaded videos for this lesson yet. Switch to “Read the lesson” in the meantime.'}
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
                <div className="flex items-center gap-1.5">
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
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
                      disabled={deletingId !== null}
                      aria-label={`Delete ${video.title}`}
                      onClick={() => void remove(video.id)}
                    >
                      {deletingId === video.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  )}
                </div>
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
