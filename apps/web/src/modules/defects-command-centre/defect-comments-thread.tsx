'use client';

import { useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { GlassCard, InlineAlert } from '@/components/studio';
import { stripHtmlForDisplay } from '@sfcc/shared';
import type { OptimisticWorkItemComment } from './types';

interface DefectCommentsThreadProps {
  workItemId: string;
  comments: OptimisticWorkItemComment[];
  loading?: boolean;
  writable: boolean;
  mutating: boolean;
  error?: string;
  onAdd: (body: string) => Promise<void>;
}

export function DefectCommentsThread({
  workItemId,
  comments,
  loading,
  writable,
  mutating,
  error,
  onAdd,
}: DefectCommentsThreadProps) {
  const [composerByItem, setComposerByItem] = useState<Record<
    string,
    { body: string; error: string | null }
  >>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(new Set<string>());
  const composer = composerByItem[workItemId] ?? { body: '', error: null };
  const composerId = `new-work-item-comment-${encodeURIComponent(workItemId)}`;
  const setComposer = (
    update: (current: { body: string; error: string | null }) => {
      body: string;
      error: string | null;
    },
  ) => {
    setComposerByItem((current) => ({
      ...current,
      [workItemId]: update(current[workItemId] ?? { body: '', error: null }),
    }));
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-label="Loading comments">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const draft = composer.body.trim();
    if (!draft || mutating || submittingRef.current.has(workItemId)) return;
    submittingRef.current.add(workItemId);
    setComposer(() => ({ body: '', error: null }));
    try {
      await onAdd(draft);
    } catch (submitFailure) {
      setComposer((current) => ({
        body: current.body || draft,
        error: submitFailure instanceof Error ? submitFailure.message : 'Unable to add comment',
      }));
      requestAnimationFrame(() => {
        if (!submittingRef.current.has(workItemId)) textareaRef.current?.focus();
      });
    } finally {
      submittingRef.current.delete(workItemId);
    }
  };

  return (
    <GlassCard title="Comments" description={`${comments.length} comment(s)`}>
      {error && <InlineAlert variant="warning" className="mb-3">{error}</InlineAlert>}
      {comments.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No comments on this work item yet.</p>
      ) : (
        <ul className="space-y-3 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-lg border border-border/50 bg-secondary/20 p-3"
              aria-busy={comment.optimisticState === 'pending'}
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="font-medium text-foreground">{comment.author.displayName}</span>
                <span aria-hidden>·</span>
                <time dateTime={comment.createdAt}>
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : '—'}
                </time>
                {comment.optimisticState === 'pending' && <span>· Posting…</span>}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">
                {stripHtmlForDisplay(comment.body)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {writable && (
        <form className="mt-4 pt-4 border-t border-border/40 space-y-2" onSubmit={(event) => void submit(event)}>
          <label htmlFor={composerId} className="text-xs font-medium text-muted-foreground">
            Add comment
          </label>
          <Textarea
            ref={textareaRef}
            id={composerId}
            value={composer.body}
            onChange={(event) => setComposer((current) => ({
              body: event.target.value,
              error: current.error,
            }))}
            rows={3}
            disabled={mutating}
          />
          {composer.error && <p role="alert" className="text-xs text-destructive">{composer.error}</p>}
          <Button type="submit" size="sm" loading={mutating} disabled={!composer.body.trim() || mutating}>
            Add comment
          </Button>
        </form>
      )}
    </GlassCard>
  );
}
