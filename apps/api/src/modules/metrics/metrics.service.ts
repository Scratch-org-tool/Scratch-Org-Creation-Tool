import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { QueueService } from '../queue/queue.service';

interface CounterEntry {
  labels: Record<string, string>;
  value: number;
}

interface HistogramEntry {
  labels: Record<string, string>;
  buckets: number[];
  sum: number;
  count: number;
}

/** Histogram bucket upper bounds for HTTP durations, in seconds. */
const DURATION_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];

const JOB_STATUSES = [
  'pending',
  'queued',
  'running',
  'completed',
  'partial',
  'failed',
  'cancelled',
] as const;

function labelKey(labels: Record<string, string>): string {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`)
    .join(',');
}

function renderLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  const body = entries
    .map(([key, value]) => `${key}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',');
  return `{${body}}`;
}

/**
 * Dependency-free metrics registry with Prometheus text exposition.
 *
 * HTTP request counters/durations are recorded by MetricsInterceptor; queue
 * depths and job counts are sampled live at scrape time so the endpoint always
 * reflects reality without a background collector.
 */
@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly counters = new Map<string, CounterEntry>();
  private readonly histograms = new Map<string, HistogramEntry>();

  constructor(private readonly queueService: QueueService) {}

  incrementCounter(name: string, labels: Record<string, string>, value = 1): void {
    const key = `${name}|${labelKey(labels)}`;
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { labels, value });
    }
  }

  observeHistogram(name: string, labels: Record<string, string>, value: number): void {
    const key = `${name}|${labelKey(labels)}`;
    let entry = this.histograms.get(key);
    if (!entry) {
      entry = { labels, buckets: DURATION_BUCKETS.map(() => 0), sum: 0, count: 0 };
      this.histograms.set(key, entry);
    }
    entry.sum += value;
    entry.count += 1;
    for (let i = 0; i < DURATION_BUCKETS.length; i += 1) {
      if (value <= DURATION_BUCKETS[i]) entry.buckets[i] += 1;
    }
  }

  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    const labels = { method, route, status: String(status) };
    this.incrementCounter('sfcc_http_requests_total', labels);
    this.observeHistogram('sfcc_http_request_duration_seconds', { method, route }, durationSeconds);
  }

  /** Full Prometheus exposition body. */
  async render(): Promise<string> {
    const lines: string[] = [];

    lines.push('# HELP sfcc_process_uptime_seconds API process uptime.');
    lines.push('# TYPE sfcc_process_uptime_seconds gauge');
    lines.push(`sfcc_process_uptime_seconds ${((Date.now() - this.startedAt) / 1000).toFixed(0)}`);

    const memory = process.memoryUsage();
    lines.push('# HELP sfcc_process_memory_bytes Resident and heap memory usage.');
    lines.push('# TYPE sfcc_process_memory_bytes gauge');
    lines.push(`sfcc_process_memory_bytes{kind="rss"} ${memory.rss}`);
    lines.push(`sfcc_process_memory_bytes{kind="heap_used"} ${memory.heapUsed}`);

    lines.push('# HELP sfcc_http_requests_total HTTP requests served, by route and status.');
    lines.push('# TYPE sfcc_http_requests_total counter');
    for (const entry of this.counters.values()) {
      lines.push(`sfcc_http_requests_total${renderLabels(entry.labels)} ${entry.value}`);
    }

    lines.push('# HELP sfcc_http_request_duration_seconds HTTP request latency histogram.');
    lines.push('# TYPE sfcc_http_request_duration_seconds histogram');
    for (const entry of this.histograms.values()) {
      let cumulative = 0;
      for (let i = 0; i < DURATION_BUCKETS.length; i += 1) {
        cumulative += entry.buckets[i];
        lines.push(
          `sfcc_http_request_duration_seconds_bucket${renderLabels({ ...entry.labels, le: String(DURATION_BUCKETS[i]) })} ${cumulative}`,
        );
      }
      lines.push(
        `sfcc_http_request_duration_seconds_bucket${renderLabels({ ...entry.labels, le: '+Inf' })} ${entry.count}`,
      );
      lines.push(
        `sfcc_http_request_duration_seconds_sum${renderLabels(entry.labels)} ${entry.sum.toFixed(6)}`,
      );
      lines.push(
        `sfcc_http_request_duration_seconds_count${renderLabels(entry.labels)} ${entry.count}`,
      );
    }

    lines.push(...(await this.renderJobMetrics()));
    lines.push(...(await this.renderQueueMetrics()));
    return `${lines.join('\n')}\n`;
  }

  private async renderJobMetrics(): Promise<string[]> {
    const lines: string[] = [
      '# HELP sfcc_jobs_total Background jobs recorded in the database, by queue and status.',
      '# TYPE sfcc_jobs_total gauge',
    ];
    try {
      const grouped = await prisma.job.groupBy({
        by: ['queue', 'status'],
        _count: { _all: true },
      });
      for (const row of grouped) {
        lines.push(
          `sfcc_jobs_total${renderLabels({ queue: row.queue, status: row.status })} ${row._count._all}`,
        );
      }
    } catch {
      // Database unavailable — expose process/HTTP metrics anyway.
    }
    return lines;
  }

  private async renderQueueMetrics(): Promise<string[]> {
    const lines: string[] = [
      '# HELP sfcc_queue_depth Live BullMQ queue depth, by queue and state.',
      '# TYPE sfcc_queue_depth gauge',
    ];
    try {
      for (const name of this.queueService.getAllQueueNames()) {
        const queue = this.queueService.getQueue(name);
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        for (const [state, value] of Object.entries(counts)) {
          lines.push(
            `sfcc_queue_depth${renderLabels({ queue: name, state })} ${value ?? 0}`,
          );
        }
      }
    } catch {
      // Redis unavailable — skip queue depth rather than failing the scrape.
    }
    return lines;
  }

  /** Exposed for the JSON summary endpoint used by the monitoring UI. */
  async summary(): Promise<{
    uptimeSeconds: number;
    memory: { rss: number; heapUsed: number };
    httpRequests: Array<{ labels: Record<string, string>; value: number }>;
    jobs: Array<{ queue: string; status: string; count: number }>;
  }> {
    let jobs: Array<{ queue: string; status: string; count: number }> = [];
    try {
      const grouped = await prisma.job.groupBy({ by: ['queue', 'status'], _count: { _all: true } });
      jobs = grouped.map((row) => ({
        queue: row.queue,
        status: row.status,
        count: row._count._all,
      }));
    } catch {
      jobs = [];
    }
    const memory = process.memoryUsage();
    return {
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      memory: { rss: memory.rss, heapUsed: memory.heapUsed },
      httpRequests: [...this.counters.values()].map((entry) => ({
        labels: entry.labels,
        value: entry.value,
      })),
      jobs,
    };
  }

  static get jobStatuses(): readonly string[] {
    return JOB_STATUSES;
  }
}
