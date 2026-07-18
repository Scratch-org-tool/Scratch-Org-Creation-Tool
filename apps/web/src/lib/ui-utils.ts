export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatTrend(pct: number | null | undefined): string {
  if (pct == null) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
}

export function trendClass(pct: number | null | undefined): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct > 0) return 'text-green-400';
  if (pct < 0) return 'text-red-400';
  return 'text-muted-foreground';
}

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'success' || s.includes('connect') || s === 'active')
    return 'bg-green-500/10 text-green-400';
  if (s === 'failed' || s.includes('fail') || s.includes('revok') || s === 'paused')
    return 'bg-red-500/10 text-red-400';
  if (s === 'running' || s === 'pending' || s === 'queued' || s === 'in progress')
    return 'bg-blue-500/10 text-blue-400';
  if (s === 'cancelled') return 'bg-muted text-muted-foreground';
  return 'bg-amber-500/10 text-amber-400';
}

export function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed') return 'Success';
  if (s === 'partial') return 'Partial';
  if (s === 'awaiting_input') return 'Awaiting input';
  if (s === 'failed' || s === 'paused') return 'Failed';
  if (s === 'running') return 'Running';
  if (s === 'cancelled') return 'Cancelled';
  if (s.includes('connect') || s === 'active') return 'Connected';
  return status;
}

export function formatDurationMs(ms: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${rem}s`;
}
