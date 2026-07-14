'use client';

import { useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileText,
  History,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import type { AzureWorkItemHistoryEvent } from './types';
import { DefectHistoryDetailDialog } from './defect-history-detail-dialog';

interface DefectHistoryTimelineProps {
  events: AzureWorkItemHistoryEvent[];
  loading?: boolean;
}

function formatShortDate(iso: string): { date: string; time: string } {
  if (!iso) return { date: '—', time: '' };
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    };
  } catch {
    return { date: iso, time: '' };
  }
}

function eventIcon(event: AzureWorkItemHistoryEvent): LucideIcon {
  switch (event.kind) {
    case 'created':
      return Plus;
    case 'comment':
      return MessageSquare;
    case 'attachment_added':
      return Paperclip;
    case 'attachment_removed':
      return Trash2;
    case 'updated': {
      const primary = event.changes[0];
      if (!primary) return History;
      if (primary.fieldRef === 'System.State') return CircleDot;
      if (primary.fieldRef === 'System.AssignedTo') return User;
      if (
        primary.fieldRef === 'System.Title' ||
        primary.fieldRef === 'System.Description' ||
        primary.fieldRef === 'Microsoft.VSTS.TCM.ReproSteps' ||
        primary.fieldRef === 'Microsoft.VSTS.Common.AcceptanceCriteria'
      ) {
        return FileText;
      }
      return History;
    }
    default:
      return History;
  }
}

export function DefectHistoryTimeline({ events, loading }: DefectHistoryTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<AzureWorkItemHistoryEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const openEvent = (event: AzureWorkItemHistoryEvent) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="pt-2 border-t border-border/40">
        <p className="text-xs font-medium text-muted-foreground mb-2">Work item history</p>
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="pt-2 border-t border-border/40">
        <p className="text-xs font-medium text-muted-foreground mb-1">Work item history</p>
        <p className="text-sm text-muted-foreground">No history available.</p>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-border/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">
            Work item history ({events.length})
          </p>
        </div>
        {events.length > 4 && (
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => scrollBy(-120)}
              aria-label="Scroll history left"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => scrollBy(120)}
              aria-label="Scroll history right"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute left-4 right-4 top-[22px] h-px bg-border/70 pointer-events-none" />
        <div
          ref={scrollRef}
          className="relative flex items-start gap-2 overflow-x-auto scrollbar-thin py-1 -mx-1 px-1"
        >
          {events.map((event, index) => {
            const Icon = eventIcon(event);
            const { date, time } = formatShortDate(event.revisedDate);
            const isLatest = index === events.length - 1;

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => openEvent(event)}
                title={event.summary}
                className={cn(
                  'relative z-10 flex flex-col items-center gap-1 shrink-0 w-[64px] rounded-lg p-1.5 transition-colors',
                  'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isLatest && 'bg-primary/10',
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border bg-background',
                    isLatest ? 'border-primary/50 text-primary' : 'border-border/60 text-muted-foreground',
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] leading-tight text-muted-foreground text-center">
                  {date}
                  {time ? (
                    <>
                      <br />
                      {time}
                    </>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <DefectHistoryDetailDialog
        event={selectedEvent}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedEvent(null);
        }}
      />
    </div>
  );
}
