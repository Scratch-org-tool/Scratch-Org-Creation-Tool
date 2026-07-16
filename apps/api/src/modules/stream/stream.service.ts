import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type IORedis from 'ioredis';
import { prisma } from '@sfcc/db';
import type { StreamEvent } from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';

const OWNER_CACHE_MAX = 2000;
const EVENT_DEDUP_MAX = 5000;

@Injectable()
export class StreamService implements OnModuleInit {
  private readonly events$ = new Subject<StreamEvent>();
  private subscriber: IORedis | null = null;
  private redisReady = false;
  /** Resource key -> owning app-user id (bounded to avoid a DB hit per event). */
  private readonly ownerCache = new Map<string, string>();
  private readonly seenEventIds = new Set<string>();

  constructor(private readonly queueService: QueueService) {}

  onModuleInit() {
    this.initRedisPubSub();
  }

  private initRedisPubSub() {
    const redis = this.queueService.getConnection();
    if (!redis) return;
    const sub = redis.duplicate();
    void sub.subscribe('sfcc:events').then(() => {
      this.redisReady = true;
    }).catch(() => {
      this.redisReady = false;
    });
    sub.on('message', (_channel, message) => {
      try {
        const event = JSON.parse(message) as StreamEvent;
        if (event.id && this.seenEventIds.has(event.id)) return;
        if (event.id) this.rememberEvent(event.id);
        this.events$.next(event);
      } catch {
        // ignore malformed messages
      }
    });
    this.subscriber = sub;
  }

  async publish(
    type: StreamEvent['type'],
    payload: Record<string, unknown>,
    ownerId?: string,
  ): Promise<void> {
    const resolvedOwner = ownerId ?? (await this.resolveOwner(payload));
    const event: StreamEvent = {
      id: randomUUID(),
      type,
      payload,
      timestamp: new Date().toISOString(),
      ...(resolvedOwner ? { ownerId: resolvedOwner } : {}),
    };
    const redis = this.queueService.getConnection();
    if (redis) {
      if (!this.redisReady) {
        this.rememberEvent(event.id!);
        this.events$.next(event);
      }
      await redis.publish('sfcc:events', JSON.stringify(event));
    } else {
      this.events$.next(event);
    }
  }

  /**
   * Subscribe to the event stream scoped to a user. Non-admin users only
   * receive events they own. Ownerless events fail closed because event
   * payloads may contain sensitive job, org, or authentication details.
   */
  subscribe(
    types?: StreamEvent['type'][],
    scope?: { userId: string; isAdmin: boolean },
  ): Observable<StreamEvent> {
    return this.events$.pipe(
      filter((e) => !types || types.includes(e.type)),
      filter((e) => {
        if (!scope) return false;
        if (scope.isAdmin) return true;
        if (!e.ownerId || e.ownerId === 'system') return false;
        return e.ownerId === scope.userId;
      }),
      map((e) => e),
    );
  }

  async publishJobLog(jobId: string, stream: 'stdout' | 'stderr', line: string): Promise<void> {
    await this.publish('job_log', { jobId, stream, line });
  }

  private async resolveOwner(payload: Record<string, unknown>): Promise<string | undefined> {
    const jobId = typeof payload.jobId === 'string' ? payload.jobId : undefined;
    const automationRunId =
      typeof payload.automationRunId === 'string' ? payload.automationRunId : undefined;

    if (jobId) {
      const cacheKey = `job:${jobId}`;
      const cached = this.ownerCache.get(cacheKey);
      if (cached) return cached;

      try {
        const job = await prisma.job.findUnique({
          where: { id: jobId },
          select: {
            createdBy: true,
            parentRun: { select: { createdBy: true } },
          },
        });
        const owner =
          job?.createdBy && job.createdBy !== 'system'
            ? job.createdBy
            : job?.parentRun?.createdBy;
        if (owner && owner !== 'system') {
          this.cacheOwner(cacheKey, owner);
          return owner;
        }
      } catch {
        // Fail closed unless another immutable owning resource resolves below.
      }
    }

    if (!automationRunId) return undefined;
    const cacheKey = `run:${automationRunId}`;
    const cached = this.ownerCache.get(cacheKey);
    if (cached) return cached;
    try {
      const run = await prisma.automationRun.findUnique({
        where: { id: automationRunId },
        select: { createdBy: true },
      });
      const owner = run?.createdBy;
      if (!owner || owner === 'system') return undefined;
      this.cacheOwner(cacheKey, owner);
      return owner;
    } catch {
      return undefined;
    }
  }

  private cacheOwner(key: string, owner: string): void {
    if (this.ownerCache.size >= OWNER_CACHE_MAX) {
      const firstKey = this.ownerCache.keys().next().value;
      if (firstKey) this.ownerCache.delete(firstKey);
    }
    this.ownerCache.set(key, owner);
  }

  private rememberEvent(id: string): void {
    if (this.seenEventIds.size >= EVENT_DEDUP_MAX) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest) this.seenEventIds.delete(oldest);
    }
    this.seenEventIds.add(id);
  }
}
