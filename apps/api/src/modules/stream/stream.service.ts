import { Injectable, OnModuleInit } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type IORedis from 'ioredis';
import { prisma } from '@sfcc/db';
import type { StreamEvent } from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';

const OWNER_CACHE_MAX = 2000;

@Injectable()
export class StreamService implements OnModuleInit {
  private readonly events$ = new Subject<StreamEvent>();
  private subscriber: IORedis | null = null;
  /** jobId -> owning app-user id (bounded cache to avoid a DB hit per log line). */
  private readonly jobOwnerCache = new Map<string, string>();

  constructor(private readonly queueService: QueueService) {}

  onModuleInit() {
    this.initRedisPubSub();
  }

  private initRedisPubSub() {
    const redis = this.queueService.getConnection();
    if (!redis) return;
    const sub = redis.duplicate();
    sub.subscribe('sfcc:events');
    sub.on('message', (_channel, message) => {
      try {
        const event = JSON.parse(message) as StreamEvent;
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
      type,
      payload,
      timestamp: new Date().toISOString(),
      ...(resolvedOwner ? { ownerId: resolvedOwner } : {}),
    };
    this.events$.next(event);
    const redis = this.queueService.getConnection();
    if (redis) {
      await redis.publish('sfcc:events', JSON.stringify(event));
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
    if (!jobId) return undefined;

    const cached = this.jobOwnerCache.get(jobId);
    if (cached) return cached;

    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { createdBy: true },
      });
      const owner = job?.createdBy ?? undefined;
      if (owner) {
        if (this.jobOwnerCache.size >= OWNER_CACHE_MAX) {
          const firstKey = this.jobOwnerCache.keys().next().value;
          if (firstKey) this.jobOwnerCache.delete(firstKey);
        }
        this.jobOwnerCache.set(jobId, owner);
      }
      return owner;
    } catch {
      return undefined;
    }
  }
}
