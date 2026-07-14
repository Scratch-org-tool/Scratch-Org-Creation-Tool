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

export function deploymentLabel(d: {
  repo: string | null;
  branch: string | null;
  targetOrgAlias: string | null;
  strategy: string | null;
}): string {
  if (d.repo && d.branch) return `${d.repo} · ${d.branch}`;
  if (d.targetOrgAlias) return d.targetOrgAlias;
  if (d.strategy) return d.strategy;
  return 'Deployment';
}

export function statusBadgeClass(status: string): string {
  if (status === 'completed') return 'bg-green-500/10 text-green-400';
  if (status === 'failed') return 'bg-red-500/10 text-red-400';
  if (status === 'running' || status === 'pending' || status === 'queued')
    return 'bg-blue-500/10 text-blue-400';
  if (status === 'cancelled') return 'bg-muted text-muted-foreground';
  return 'bg-amber-500/10 text-amber-400';
}

export function statusLabel(status: string): string {
  if (status === 'completed') return 'Success';
  if (status === 'failed') return 'Failed';
  if (status === 'running') return 'Running';
  if (status === 'cancelled') return 'Cancelled';
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
