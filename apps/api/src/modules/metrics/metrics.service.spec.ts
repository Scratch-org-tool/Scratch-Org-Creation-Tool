import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  job: {
    groupBy: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { MetricsService } from './metrics.service';

function createService() {
  const queue = {
    getAllQueueNames: vi.fn().mockReturnValue(['metadata-deploy']),
    getQueue: vi.fn().mockReturnValue({
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 2, active: 1, delayed: 0, failed: 3 }),
    }),
  };
  const service = new MetricsService(queue as never);
  return { service, queue };
}

describe('MetricsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.job.groupBy.mockResolvedValue([
      { queue: 'metadata-deploy', status: 'completed', _count: { _all: 12 } },
      { queue: 'data-deploy', status: 'failed', _count: { _all: 2 } },
    ]);
  });

  it('renders counters, histograms, job totals, and queue depth in Prometheus format', async () => {
    const { service } = createService();
    service.recordHttpRequest('GET', '/api/drift/monitors', 200, 0.12);
    service.recordHttpRequest('GET', '/api/drift/monitors', 200, 0.4);
    service.recordHttpRequest('POST', '/api/deployments', 500, 2);

    const body = await service.render();

    expect(body).toContain('sfcc_http_requests_total{method="GET",route="/api/drift/monitors",status="200"} 2');
    expect(body).toContain('sfcc_http_requests_total{method="POST",route="/api/deployments",status="500"} 1');
    expect(body).toContain('sfcc_http_request_duration_seconds_count{method="GET",route="/api/drift/monitors"} 2');
    expect(body).toContain('sfcc_jobs_total{queue="metadata-deploy",status="completed"} 12');
    expect(body).toContain('sfcc_queue_depth{queue="metadata-deploy",state="waiting"} 2');
    expect(body).toContain('sfcc_process_uptime_seconds');
  });

  it('keeps the scrape alive when the database or Redis is down', async () => {
    const { service } = createService();
    db.job.groupBy.mockRejectedValue(new Error('db down'));
    const body = await service.render();
    expect(body).toContain('sfcc_process_uptime_seconds');
    expect(body).not.toContain('sfcc_jobs_total{');
  });

  it('summarizes jobs for the monitoring dashboard', async () => {
    const { service } = createService();
    const summary = await service.summary();
    expect(summary.jobs).toEqual([
      { queue: 'metadata-deploy', status: 'completed', count: 12 },
      { queue: 'data-deploy', status: 'failed', count: 2 },
    ]);
    expect(summary.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
