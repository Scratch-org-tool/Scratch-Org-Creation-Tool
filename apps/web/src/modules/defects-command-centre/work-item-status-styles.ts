export type WorkItemStatusTone = 'success' | 'progress' | 'open' | 'danger' | 'muted';

export function workItemStatusTone(status: string): WorkItemStatusTone {
  const s = status.toLowerCase().trim();
  if (['done', 'closed', 'resolved', 'completed'].includes(s)) return 'success';
  if (
    ['doing', 'in progress', 'active', 'committed', 'in review', 'in test', 'testing'].includes(s)
  ) {
    return 'progress';
  }
  if (['removed', 'cut'].includes(s)) return 'danger';
  if (['to do', 'new', 'proposed', 'open'].includes(s) || s.includes('backlog')) return 'open';
  return 'muted';
}

const toneStyles: Record<
  WorkItemStatusTone,
  { badge: string; select: string; item: string }
> = {
  success: {
    badge: 'bg-green-500/15 text-green-400',
    select: 'border-green-500/50 bg-green-500/10 text-green-400',
    item: 'text-green-400 focus:bg-green-500/10 focus:text-green-300',
  },
  progress: {
    badge: 'bg-blue-500/15 text-blue-400',
    select: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
    item: 'text-blue-400 focus:bg-blue-500/10 focus:text-blue-300',
  },
  open: {
    badge: 'bg-amber-500/15 text-amber-400',
    select: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
    item: 'text-amber-400 focus:bg-amber-500/10 focus:text-amber-300',
  },
  danger: {
    badge: 'bg-red-500/15 text-red-400',
    select: 'border-red-500/50 bg-red-500/10 text-red-400',
    item: 'text-red-400 focus:bg-red-500/10 focus:text-red-300',
  },
  muted: {
    badge: 'bg-muted/80 text-muted-foreground',
    select: 'border-border bg-muted/40 text-muted-foreground',
    item: 'text-muted-foreground focus:bg-muted focus:text-foreground',
  },
};

export function workItemStatusBadgeClass(status: string): string {
  return toneStyles[workItemStatusTone(status)].badge;
}

export function workItemStatusSelectClass(status: string): string {
  return `${toneStyles[workItemStatusTone(status)].select} font-medium`;
}

export function workItemStatusItemClass(status: string): string {
  return toneStyles[workItemStatusTone(status)].item;
}
