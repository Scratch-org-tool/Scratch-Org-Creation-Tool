import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { StreamEvent } from '@sfcc/shared';

const db = vi.hoisted(() => ({
  job: { findUnique: vi.fn() },
  automationRun: { findUnique: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));

import { StreamService } from './stream.service';
import { StreamTicketService } from './stream-ticket.service';
import { StreamTicketGuard, type StreamRequest } from './stream-ticket.guard';

class FakeRedis {
  private readonly values = new Map<string, string>();

  async set(key: string, value: string) {
    if (this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }

  async eval(_script: string, _keyCount: number, key: string) {
    const value = this.values.get(key) ?? null;
    this.values.delete(key);
    return value;
  }
}

class FakePubSubRedis {
  private messageHandler?: (channel: string, message: string) => void;
  private subscriber?: FakePubSubRedis;

  duplicate() {
    this.subscriber = new FakePubSubRedis();
    return this.subscriber;
  }

  subscribe(_channel: string) {
    return Promise.resolve(1);
  }

  on(event: string, handler: (channel: string, message: string) => void) {
    if (event === 'message') this.messageHandler = handler;
  }

  async publish(channel: string, message: string) {
    this.subscriber?.messageHandler?.(channel, message);
    return 1;
  }
}

function contextFor(request: Partial<StreamRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('stream tickets', () => {
  it('issues short-lived tickets that can only be consumed once', async () => {
    const redis = new FakeRedis();
    const service = new StreamTicketService({
      getConnection: () => redis,
    } as never);
    const issued = await service.issue({ userId: 'DPT_owner', isAdmin: false });

    await expect(service.consume(issued.ticket)).resolves.toEqual({
      userId: 'DPT_owner',
      isAdmin: false,
    });
    await expect(service.consume(issued.ticket)).resolves.toBeNull();
  });

  it('rejects missing and reused tickets in the SSE guard', async () => {
    const redis = new FakeRedis();
    const tickets = new StreamTicketService({
      getConnection: () => redis,
    } as never);
    const guard = new StreamTicketGuard(tickets);
    await expect(
      guard.canActivate(contextFor({ headers: {}, query: {} })),
    ).rejects.toThrow(UnauthorizedException);

    const issued = await tickets.issue({ userId: 'DPT_owner', isAdmin: false });
    const request: Partial<StreamRequest> = {
      headers: {},
      query: { ticket: issued.ticket },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.streamScope?.userId).toBe('DPT_owner');
    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('stream ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to denying ownerless and foreign events for non-admins', async () => {
    const service = new StreamService({
      getConnection: () => null,
    } as never);
    const received: StreamEvent[] = [];
    service.subscribe(undefined, {
      userId: 'DPT_owner',
      isAdmin: false,
    }).subscribe((event) => received.push(event));

    await service.publish('auth_status', { status: 'ownerless' });
    await service.publish('auth_status', { status: 'foreign' }, 'DPT_other');
    await service.publish('auth_status', { status: 'owned' }, 'DPT_owner');

    expect(received.map((event) => event.payload.status)).toEqual(['owned']);
  });

  it('routes automation-run events only to the run owner', async () => {
    db.automationRun.findUnique.mockResolvedValue({ createdBy: 'DPT_owner' });
    const service = new StreamService({ getConnection: () => null } as never);
    const ownerEvents: StreamEvent[] = [];
    const unrelatedEvents: StreamEvent[] = [];
    service.subscribe(undefined, { userId: 'DPT_owner', isAdmin: false })
      .subscribe((event) => ownerEvents.push(event));
    service.subscribe(undefined, { userId: 'DPT_other', isAdmin: false })
      .subscribe((event) => unrelatedEvents.push(event));

    await service.publish('job_status', {
      automationRunId: 'run-1',
      status: 'query-completed',
    });

    expect(ownerEvents).toHaveLength(1);
    expect(unrelatedEvents).toHaveLength(0);
  });

  it('uses the parent run owner for system-owned child jobs', async () => {
    db.job.findUnique.mockResolvedValue({
      createdBy: 'system',
      parentRun: { createdBy: 'DPT_owner' },
    });
    const service = new StreamService({ getConnection: () => null } as never);
    const ownerEvents: StreamEvent[] = [];
    const unrelatedEvents: StreamEvent[] = [];
    service.subscribe(undefined, { userId: 'DPT_owner', isAdmin: false })
      .subscribe((event) => ownerEvents.push(event));
    service.subscribe(undefined, { userId: 'DPT_other', isAdmin: false })
      .subscribe((event) => unrelatedEvents.push(event));

    await service.publish('job_status', {
      jobId: 'system-provision-job',
      status: 'provisioned',
    });

    expect(ownerEvents).toHaveLength(1);
    expect(unrelatedEvents).toHaveLength(0);
    expect(db.job.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        parentRun: { select: { createdBy: true } },
      }),
    }));
  });

  it('delivers a Redis-published event once without a local duplicate', async () => {
    const redis = new FakePubSubRedis();
    const service = new StreamService({ getConnection: () => redis } as never);
    service.onModuleInit();
    const received: StreamEvent[] = [];
    service.subscribe(undefined, { userId: 'DPT_owner', isAdmin: false })
      .subscribe((event) => received.push(event));

    await service.publish('job_status', { status: 'running' }, 'DPT_owner');

    expect(received).toHaveLength(1);
    expect(received[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
