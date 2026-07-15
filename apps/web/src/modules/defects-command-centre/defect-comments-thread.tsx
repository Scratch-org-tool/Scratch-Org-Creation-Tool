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
  comments: OptimisticWorkItemComment[];
  loading?: boolean;
  writable: boolean;
  mutating: boolean;
  error?: string;
  onAdd: (body: string) => Promise<void>;
}

export function DefectCommentsThread({
  comments,
  loading,
  writable,
  mutating,
  error,
  onAdd,
}: DefectCommentsThreadProps) {
  const [body, setBody] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);

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
    const draft = body.trim();
    if (!draft || mutating || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    setBody('');
    try {
      await onAdd(draft);
    } catch (submitFailure) {
      setBody((current) => current || draft);
      setSubmitError(submitFailure instanceof Error ? submitFailure.message : 'Unable to add comment');
      requestAnimationFrame(() => textareaRef.current?.focus());
    } finally {
      submittingRef.current = false;
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
          <label htmlFor="new-work-item-comment" className="text-xs font-medium text-muted-foreground">
            Add comment
          </label>
          <Textarea
            ref={textareaRef}
            id="new-work-item-comment"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            disabled={mutating}
          />
          {submitError && <p role="alert" className="text-xs text-destructive">{submitError}</p>}
          <Button type="submit" size="sm" loading={mutating} disabled={!body.trim() || mutating}>
            Add comment
          </Button>
        </form>
      )}
    </GlassCard>
  );
}
