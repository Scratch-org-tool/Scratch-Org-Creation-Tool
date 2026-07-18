'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Clock, Loader2, Trash2, Upload, User, Video } from 'lucide-react';
import {
  LEARNING_VIDEO_MIME_TYPES,
  LEARNING_VIDEO_TITLE_MAX,
  formatVideoSize,
  type LearningLessonVideoView,
} from '@sfcc/shared';
import { ConfirmBanner, GlassCard, InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteLessonVideo, fetchLessonVideos, uploadLessonVideo } from './learning-api';
import { formatDate } from './learning-ui';
import type { LearningPathSummary } from './types';

const VIDEO_ACCEPT = LEARNING_VIDEO_MIME_TYPES.join(',');

/**
 * Admin manager for lesson video sessions, surfaced on Academy Progress.
 * Pick a path → module → lesson, upload the recorded videos, and remove
 * outdated ones. Learners see the result in that lesson's watch-only
 * "Video session" tab — they never get upload controls.
 */
export function VideoSessionManager({ paths }: { paths: LearningPathSummary[] }) {
  const [pathId, setPathId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [lessonId, setLessonId] = useState('');

  const selectedPath = useMemo(
    () => paths.find((path) => path.id === pathId) ?? null,
    [paths, pathId],
  );
  const selectedModule = useMemo(
    () => selectedPath?.modules.find((module) => module.id === moduleId) ?? null,
    [selectedPath, moduleId],
  );

  const [videos, setVideos] = useState<LearningLessonVideoView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingDelete, setPendingDelete] = useState<LearningLessonVideoView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resetUploadForm = () => {
    setFile(null);
    setTitle('');
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    setPendingDelete(null);
    if (!lessonId) {
      setVideos([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLessonVideos(lessonId)
      .then((list) => {
        if (!cancelled) setVideos(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load this lesson’s videos');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const selectPath = (nextPathId: string) => {
    setPathId(nextPathId);
    setModuleId('');
    setLessonId('');
    resetUploadForm();
  };

  const selectModule = (nextModuleId: string) => {
    setModuleId(nextModuleId);
    setLessonId('');
    resetUploadForm();
  };

  const selectLesson = (nextLessonId: string) => {
    setLessonId(nextLessonId);
    resetUploadForm();
  };

  const submitUpload = async () => {
    if (!file || !lessonId || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const created = await uploadLessonVideo(lessonId, file, title);
      setVideos((current) => [...current, created]);
      resetUploadForm();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteLessonVideo(pendingDelete.id);
      setVideos((current) => current.filter((video) => video.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete this video');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <GlassCard
      title="Lesson video sessions"
      description="Upload the training videos learners watch in each lesson's Video session tab. Only administrators can manage these."
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="video-manager-path" className="text-xs text-muted-foreground">
              Learning path
            </Label>
            <Select
              id="video-manager-path"
              value={pathId}
              onChange={(event) => selectPath(event.target.value)}
              className="h-9 text-sm"
            >
              <option value="">Select a path…</option>
              {paths.map((path) => (
                <option key={path.id} value={path.id}>
                  {path.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video-manager-module" className="text-xs text-muted-foreground">
              Module
            </Label>
            <Select
              id="video-manager-module"
              value={moduleId}
              onChange={(event) => selectModule(event.target.value)}
              disabled={!selectedPath}
              className="h-9 text-sm"
            >
              <option value="">Select a module…</option>
              {(selectedPath?.modules ?? []).map((module, index) => (
                <option key={module.id} value={module.id}>
                  {index + 1}. {module.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video-manager-lesson" className="text-xs text-muted-foreground">
              Lesson
            </Label>
            <Select
              id="video-manager-lesson"
              value={lessonId}
              onChange={(event) => selectLesson(event.target.value)}
              disabled={!selectedModule}
              className="h-9 text-sm"
            >
              <option value="">Select a lesson…</option>
              {(selectedModule?.lessons ?? []).map((lesson, index) => (
                <option key={lesson.id} value={lesson.id}>
                  {index + 1}. {lesson.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {!lessonId ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 px-6 py-8 text-center">
            <Clapperboard className="size-7 text-muted-foreground/50" />
            <p className="text-sm font-medium">Pick a lesson to manage its videos</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Uploads appear immediately in that lesson for every learner with Academy access.
            </p>
          </div>
        ) : (
          <>
            {error && <InlineAlert variant="error">{error}</InlineAlert>}

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
                  accept={VIDEO_ACCEPT}
                  aria-label="Choose a video file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary/70 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary"
                />
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Title (optional — defaults to the file name)"
                  maxLength={LEARNING_VIDEO_TITLE_MAX}
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

            {pendingDelete && (
              <ConfirmBanner
                title={`Delete “${pendingDelete.title}”?`}
                message="The video file is removed and learners immediately stop seeing it on the lesson."
                confirmLabel="Delete video"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
                loading={deleting}
              />
            )}

            {loading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 px-6 py-8 text-center">
                <Video className="size-7 text-muted-foreground/50" />
                <p className="text-sm font-medium">No videos for this lesson yet</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Upload the first one above — it appears in the lesson’s Video session tab for
                  every learner.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {videos.map((video) => (
                  <li
                    key={video.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-3"
                  >
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
                      disabled={deleting}
                      aria-label={`Delete ${video.title}`}
                      onClick={() => setPendingDelete(video)}
                    >
                      {deleting && pendingDelete?.id === video.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </GlassCard>
  );
}
