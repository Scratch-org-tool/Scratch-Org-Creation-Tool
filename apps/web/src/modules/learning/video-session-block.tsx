'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  Clock,
  Copy,
  Download,
  FileText,
  Loader2,
  PlayCircle,
  Trash2,
  Upload,
  User,
  Video,
} from 'lucide-react';
import {
  formatVideoSize,
  videoScriptToMarkdown,
  videoScriptToNarration,
  type LearningLessonVideoView,
  type LessonVideoScript,
} from '@sfcc/shared';
import { useAuth } from '@/contexts/auth-context';
import { InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  deleteLessonVideo,
  fetchLessonVideoBlob,
  fetchLessonVideos,
  fetchVideoScript,
  uploadLessonVideo,
} from './learning-api';
import { formatDate } from './learning-ui';

function downloadText(filename: string, text: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Hybrid video sessions:
 * 1. Admin-uploaded MP4/WebM videos (primary learner experience)
 * 2. Production script export (AI/curriculum) so admins can record the
 *    5-minute session and upload it afterward
 */
export function VideoSessionBlock({
  lessonId,
  onPlayAnimated,
}: {
  lessonId: string;
  onPlayAnimated?: () => void;
}) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [videos, setVideos] = useState<LearningLessonVideoView[]>([]);
  const [script, setScript] = useState<LessonVideoScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

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
    Promise.all([
      fetchLessonVideos(lessonId).catch(() => [] as LearningLessonVideoView[]),
      fetchVideoScript(lessonId).catch(() => null),
    ])
      .then(([list, nextScript]) => {
        if (cancelled) return;
        setVideos(list);
        setScript(nextScript);
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

  const copyScript = useCallback(async () => {
    if (!script) return;
    await navigator.clipboard.writeText(videoScriptToMarkdown(script));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [script]);

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
        <div className="rounded-xl border border-sky-400/25 bg-sky-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="size-4 text-sky-300" />
            Upload a video session
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Record from the production script below, then upload MP4, WebM, OGG, MOV, MKV, or AVI.
            Learners see uploaded videos immediately.
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
          <p className="text-sm font-medium">No uploaded videos yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {isAdmin
              ? 'Use the production script below to record a ~5 minute session, then upload it here.'
              : 'Your administrator has not uploaded a video for this lesson yet. You can still use the production script or switch to “Read the lesson”.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {videos.map((video) => (
            <li key={video.id} className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
                    <Clapperboard className="size-4 text-sky-300" />
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

      {script && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4 text-sky-300" />
                5-minute production script
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {script.segments.length} segments · ~{Math.max(1, Math.round(script.totalDurationSeconds / 60))}{' '}
                min · source {script.source}. Export narration for your recording tool, then upload
                the finished video above.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {onPlayAnimated && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={onPlayAnimated}
                >
                  <PlayCircle className="size-3.5" />
                  Play animated
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => void copyScript()}
              >
                <Copy className="size-3.5" />
                {copied ? 'Copied' : 'Copy script'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() =>
                  downloadText(
                    `${script.lessonId}-video-script.md`,
                    videoScriptToMarkdown(script),
                    'text/markdown',
                  )
                }
              >
                <Download className="size-3.5" />
                Script .md
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() =>
                  downloadText(
                    `${script.lessonId}-narration.txt`,
                    videoScriptToNarration(script),
                  )
                }
              >
                <Download className="size-3.5" />
                Narration .txt
              </Button>
            </div>
          </div>
          <ol className="mt-3 space-y-2">
            {script.segments.slice(0, 6).map((segment) => (
              <li
                key={segment.id}
                className="rounded-lg border border-border/50 bg-background/40 px-3 py-2"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {segment.kind} · {segment.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-foreground/85">{segment.narration}</p>
              </li>
            ))}
          </ol>
          {script.segments.length > 6 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              +{script.segments.length - 6} more segments in the full export.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
