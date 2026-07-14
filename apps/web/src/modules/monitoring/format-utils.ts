export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return rem ? `${min}m ${rem}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${hr}h ${m}m` : `${hr}h`;
}

export function isJobLive(status: string): boolean {
  return status === 'running' || status === 'pending' || status === 'queued';
}

export function trendLabel(pct: number | null | undefined, days: number, fallback: string): string {
  if (pct == null) return fallback;
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '—';
  return `${arrow} ${Math.abs(pct)}% vs last ${days} days`;
}
