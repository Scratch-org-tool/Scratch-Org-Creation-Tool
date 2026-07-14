'use client';

import { MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard } from '@/components/studio';
import { stripHtmlForDisplay } from '@sfcc/shared';
import type { AzureWorkItemComment } from './types';

interface DefectCommentsThreadProps {
  comments: AzureWorkItemComment[];
  loading?: boolean;
}

export function DefectCommentsThread({ comments, loading }: DefectCommentsThreadProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <GlassCard title="Comments" description={`${comments.length} comment(s)`}>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No comments on this work item yet.</p>
      ) : (
        <ul className="space-y-3 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border/50 bg-secondary/20 p-3"
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="font-medium text-foreground">{c.author}</span>
                <span>·</span>
                <time dateTime={c.createdDate}>
                  {c.createdDate ? new Date(c.createdDate).toLocaleString() : '—'}
                </time>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">
                {stripHtmlForDisplay(c.text)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
