import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type IORedis from 'ioredis';
import { prisma } from '@sfcc/db';
import { QueueService } from '../queue/queue.service';

const CANCEL_CHANNEL = 'sfcc:job-cancel';
const CANCEL_KEY_PREFIX = 'sfcc:job-cancelled:';
const CANCEL_TTL_SECONDS = 24 * 60 * 60;
const MAX_LOCAL_CANCELLATIONS = 10_000;

/**
 * Tracks kill handlers for long-running worker child processes (bulk exports,
 * SFDMU runs, metadata deploys) keyed by DB job id, so user-initiated cancels
 * actually stop the underlying Salesforce CLI process.
 *
 * Cancellation is broadcast over Redis pub/sub so it works when the API runs
 * as a cluster of multiple processes behind the gateway: whichever instance
 * owns the child process receives the broadcast and kills it locally.
 */
@Injectable()
export class JobProcessRegistryService implements OnModuleInit, OnModuleDestroy {
  private readonly killHandlers = new Map<string, Set<() => void>>();
  private readonly cancelledJobs = new Map<string, number>();
  private subscriber: IORedis | null = null;

  constructor(private readonly queueService: QueueService) {}

  onModuleInit() {
    const redis = this.queueService.getConnection();
    if (!redis) return;
    const sub = redis.duplicate();
    sub.subscribe(CANCEL_CHANNEL).catch(() => undefined);
    sub.on('message', (_channel, jobId) => {
      this.killLocal(jobId);
    });
    this.subscriber = sub;
  }

  async onModuleDestroy() {
    await this.subscriber?.quit().catch(() => undefined);
  }

  register(dbJobId: string, kill: () => void): () => void {
    if (this.isCancelled(dbJobId)) {
      kill();
      return () => undefined;
    }
    let handlers = this.killHandlers.get(dbJobId);
    if (!handlers) {
      handlers = new Set();
      this.killHandlers.set(dbJobId, handlers);
    }
    handlers.add(kill);
    return () => {
      const set = this.killHandlers.get(dbJobId);
      set?.delete(kill);
      if (set && set.size === 0) this.killHandlers.delete(dbJobId);
    };
  }

  isCancelled(dbJobId: string): boolean {
    const expiresAt = this.cancelledJobs.get(dbJobId);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      this.cancelledJobs.delete(dbJobId);
      return false;
    }
    return true;
  }

  /**
   * Check local, Redis, and Postgres cancellation state. Postgres is the
   * durable source of truth if a worker starts after the pub/sub broadcast.
   */
  async isCancellationRequested(dbJobId: string): Promise<boolean> {
    if (this.isCancelled(dbJobId)) return true;

    const redis = this.queueService.getConnection();
    const redisCancelled = redis
      ? await redis.exists(`${CANCEL_KEY_PREFIX}${dbJobId}`).catch(() => 0)
      : 0;
    if (redisCancelled > 0) {
      this.rememberCancellation(dbJobId);
      return true;
    }

    const job = await prisma.job.findUnique({
      where: { id: dbJobId },
      select: { status: true },
    }).catch(() => null);
    if (job?.status === 'cancelled') {
      this.rememberCancellation(dbJobId);
      return true;
    }
    return false;
  }

  clear(dbJobId: string) {
    this.killHandlers.delete(dbJobId);
  }

  /** Cancel across all API instances. */
  async cancel(dbJobId: string): Promise<void> {
    this.killLocal(dbJobId);
    const redis = this.queueService.getConnection();
    if (redis) {
      await Promise.all([
        redis.set(`${CANCEL_KEY_PREFIX}${dbJobId}`, '1', 'EX', CANCEL_TTL_SECONDS),
        redis.publish(CANCEL_CHANNEL, dbJobId),
      ]).catch(() => undefined);
    }
  }

  private killLocal(dbJobId: string) {
    this.rememberCancellation(dbJobId);
    const handlers = this.killHandlers.get(dbJobId);
    if (handlers) {
      for (const kill of handlers) {
        try {
          kill();
        } catch {
          // best-effort kill
        }
      }
      this.killHandlers.delete(dbJobId);
    }
  }

  private rememberCancellation(dbJobId: string) {
    // Map insertion order gives us an inexpensive LRU: refresh this entry,
    // prune expired entries, then evict only the oldest entries over the cap.
    this.cancelledJobs.delete(dbJobId);
    this.cancelledJobs.set(dbJobId, Date.now() + CANCEL_TTL_SECONDS * 1000);
    const now = Date.now();
    for (const [jobId, expiresAt] of this.cancelledJobs) {
      if (expiresAt > now) break;
      this.cancelledJobs.delete(jobId);
    }
    while (this.cancelledJobs.size > MAX_LOCAL_CANCELLATIONS) {
      const oldest = this.cancelledJobs.keys().next().value as string | undefined;
      if (!oldest) break;
      this.cancelledJobs.delete(oldest);
    }
  }
}
