import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type IORedis from 'ioredis';
import { QueueService } from '../queue/queue.service';

const CANCEL_CHANNEL = 'sfcc:job-cancel';

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
  private readonly cancelledJobs = new Set<string>();
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
    if (this.cancelledJobs.has(dbJobId)) {
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
    return this.cancelledJobs.has(dbJobId);
  }

  clear(dbJobId: string) {
    this.killHandlers.delete(dbJobId);
    this.cancelledJobs.delete(dbJobId);
  }

  /** Cancel across all API instances. */
  async cancel(dbJobId: string): Promise<void> {
    this.killLocal(dbJobId);
    const redis = this.queueService.getConnection();
    if (redis) {
      await redis.publish(CANCEL_CHANNEL, dbJobId).catch(() => undefined);
    }
  }

  private killLocal(dbJobId: string) {
    this.cancelledJobs.add(dbJobId);
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
    // Avoid unbounded growth of the cancelled set.
    if (this.cancelledJobs.size > 10_000) {
      this.cancelledJobs.clear();
    }
  }
}
