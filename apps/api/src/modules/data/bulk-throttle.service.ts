import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { QueueService } from '../queue/queue.service';

const DEFAULT_MAX_CONCURRENT = 2;
/** Slots not renewed within this window are considered leaked (crashed worker) and reclaimed. */
const SLOT_STALE_MS = 10 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

export interface BulkThrottleSlot {
  release: () => Promise<void>;
}

/**
 * Per-org Bulk API concurrency limiter backed by a Redis sorted set.
 * Each holder registers a slot member scored by its last heartbeat; slots from
 * crashed workers go stale and are reclaimed automatically instead of leaking
 * capacity for hours.
 */
@Injectable()
export class BulkThrottleService {
  constructor(private readonly queueService: QueueService) {}

  private key(orgAlias: string): string {
    return `sfcc:bulk-active:${orgAlias}`;
  }

  private maxConcurrent(): number {
    const parsed = parseInt(process.env.SF_MAX_CONCURRENT_BULK_PER_ORG ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CONCURRENT;
  }

  async acquire(orgAlias: string): Promise<BulkThrottleSlot> {
    const redis = this.queueService.getConnection();
    const key = this.key(orgAlias);
    const member = randomUUID();
    const max = this.maxConcurrent();
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 0; attempt < 600; attempt += 1) {
      const now = Date.now();
      await redis.zremrangebyscore(key, '-inf', now - SLOT_STALE_MS);
      const active = await redis.zcard(key);
      if (active < max) {
        await redis.zadd(key, now, member);
        // Re-check: another worker may have grabbed the last slot concurrently.
        const rank = await redis.zrank(key, member);
        const total = await redis.zcard(key);
        if (rank !== null && (total <= max || rank < max)) {
          return this.buildSlot(orgAlias, member);
        }
        await redis.zrem(key, member);
      }
      await sleep(Math.min(5000, 500 + attempt * 50));
    }
    throw new Error(`Bulk API throttle timeout for org ${orgAlias}`);
  }

  private buildSlot(orgAlias: string, member: string): BulkThrottleSlot {
    const redis = this.queueService.getConnection();
    const key = this.key(orgAlias);
    const heartbeat = setInterval(() => {
      redis.zadd(key, Date.now(), member).catch(() => undefined);
    }, HEARTBEAT_INTERVAL_MS);
    heartbeat.unref?.();

    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        clearInterval(heartbeat);
        await redis.zrem(key, member).catch(() => undefined);
      },
    };
  }
}
