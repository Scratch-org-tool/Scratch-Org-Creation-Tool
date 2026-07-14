import type { ClassifiedLog, DeployPhase, DeploymentRow, HistoryFilter, LogLevel } from './types';
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from './types';

export function classifyLogLine(line: string, stream?: string): LogLevel {
  const lower = line.toLowerCase();
  if (stream === 'stderr' || lower.includes('error') || lower.includes('fail') || lower.includes('[pipe')) {
    return 'error';
  }
  if (lower.includes('warn')) return 'warning';
  if (lower.includes('success') || lower.includes('complete') || lower.includes('succeeded')) {
    return 'success';
  }
  return 'info';
}

export function classifyLogs(lines: string[], streams?: string[]): ClassifiedLog[] {
  return lines.map((line, i) => ({
    line,
    level: classifyLogLine(line, streams?.[i]),
  }));
}

export function resolveDeployPhase(opts: {
  jobStatus: string | null;
  currentStep?: string | null;
  logs: string[];
}): DeployPhase {
  const { jobStatus, currentStep, logs } = opts;
  const recent = logs.length > 120 ? logs.slice(-120) : logs;
  const has = (pattern: string) => recent.some((l) => l.toLowerCase().includes(pattern));

  if (jobStatus === 'failed') return 'failed';
  if (jobStatus === 'completed') return 'completed';

  const step = currentStep ?? '';
  if (step === 'Deployment Completed') return 'completed';
  if (step === 'Deploying Metadata' || has('deploying manifest')) return 'deploying';
  if (step === 'Fetching Repository' || has('cloning')) return 'fetching';
  if (jobStatus && ACTIVE_STATUSES.includes(jobStatus)) return 'connecting';
  return 'connecting';
}

export function phaseState(
  phaseId: DeployPhase,
  current: DeployPhase,
  jobStatus: string | null,
): 'done' | 'active' | 'pending' | 'failed' {
  if (jobStatus === 'failed') {
    const order: DeployPhase[] = ['connecting', 'fetching', 'deploying', 'completed'];
    const failAt = logsIndicatePhase(current, jobStatus);
    const fi = order.indexOf(failAt === 'failed' ? 'deploying' : failAt);
    const pi = order.indexOf(phaseId);
    if (pi < fi) return 'done';
    if (pi === fi) return 'failed';
    return 'pending';
  }
  if (current === 'completed') return phaseId === 'completed' ? 'done' : 'done';
  const order: DeployPhase[] = ['connecting', 'fetching', 'deploying', 'completed'];
  const ci = order.indexOf(current === 'failed' ? 'deploying' : current);
  const pi = order.indexOf(phaseId);
  if (phaseId === 'completed' && jobStatus === 'completed') return 'done';
  if (pi < ci) return 'done';
  if (pi === ci) return 'active';
  return 'pending';
}

function logsIndicatePhase(current: DeployPhase, jobStatus: string | null): DeployPhase {
  if (jobStatus === 'failed') return current === 'connecting' ? 'fetching' : current;
  return current;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${rem}s`;
}

export function formatElapsed(startMs: number): string {
  const s = Math.floor((Date.now() - startMs) / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString();
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function deploymentDuration(row: DeploymentRow): string | null {
  const started = row.job?.startedAt ?? row.job?.createdAt;
  const finished = row.job?.finishedAt;
  if (!started || !finished) return null;
  return formatDuration(new Date(finished).getTime() - new Date(started).getTime());
}

export function matchesHistoryFilter(status: string, filter: HistoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'running') return ACTIVE_STATUSES.includes(status);
  if (filter === 'success') return status === 'completed';
  if (filter === 'failed') return status === 'failed';
  if (filter === 'cancelled') return status === 'cancelled';
  return true;
}

export function statusLabel(status: string): string {
  if (status === 'completed') return 'Success';
  if (status === 'failed') return 'Failed';
  if (ACTIVE_STATUSES.includes(status)) return 'Running';
  if (status === 'cancelled') return 'Cancelled';
  return status;
}

export function statusBadgeClass(status: string): string {
  if (status === 'completed') return 'bg-green-500/10 text-green-400';
  if (status === 'failed') return 'bg-red-500/10 text-red-400';
  if (ACTIVE_STATUSES.includes(status)) return 'bg-blue-500/10 text-blue-400';
  if (status === 'cancelled') return 'bg-muted text-muted-foreground';
  return 'bg-amber-500/10 text-amber-400';
}

export function isTerminal(status: string | null): boolean {
  return !!status && TERMINAL_STATUSES.includes(status);
}
