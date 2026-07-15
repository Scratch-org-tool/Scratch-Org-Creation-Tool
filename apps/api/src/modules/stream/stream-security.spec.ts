import { describe, expect, it } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { StreamEvent } from '@sfcc/shared';
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
});
