'use client';

import { stripHtmlForDisplay } from '@sfcc/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WorkItemHistoryEvent } from './types';

interface DefectHistoryDetailDialogProps {
  event: WorkItemHistoryEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatWhen(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatValue(value: string | null): string {
  if (!value) return '—';
  return stripHtmlForDisplay(value);
}

function dialogTitle(event: WorkItemHistoryEvent): string {
  switch (event.kind) {
    case 'created':
      return 'Created';
    case 'comment':
      return 'Comment';
    case 'attachment_added':
      return 'Attachment added';
    case 'attachment_removed':
      return 'Attachment removed';
    default:
      return event.version > 0 ? `Update #${event.version}` : 'Update';
  }
}

export function DefectHistoryDetailDialog({
  event,
  open,
  onOpenChange,
}: DefectHistoryDetailDialogProps) {
  if (!event) return null;

  const showFieldChanges = event.changes.length > 0;
  const showBody =
    event.body &&
    (event.kind === 'comment' ||
      event.kind === 'attachment_added' ||
      event.kind === 'attachment_removed');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle(event)}</DialogTitle>
          <DialogDescription>
            {formatWhen(event.occurredAt)} · {event.actor.displayName}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm font-medium text-foreground -mt-1">{event.summary}</p>

        {showBody && (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm whitespace-pre-wrap break-words">
            {formatValue(event.body ?? null)}
          </div>
        )}

        {showFieldChanges && (
          <ul className="max-h-[50vh] overflow-y-auto scrollbar-thin space-y-3 pr-1">
            {event.changes.map((change) => (
              <li
                key={`${change.fieldRef ?? change.field}-${change.oldValue}-${change.newValue}`}
                className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm"
              >
                <p className="text-xs font-medium text-muted-foreground mb-1">{change.field}</p>
                {change.oldValue && change.newValue ? (
                  <p className="whitespace-pre-wrap break-words">
                    <span className="text-muted-foreground">{formatValue(change.oldValue)}</span>
                    <span className="mx-1.5 text-muted-foreground">→</span>
                    <span>{formatValue(change.newValue)}</span>
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">
                    {formatValue(change.newValue ?? change.oldValue)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
