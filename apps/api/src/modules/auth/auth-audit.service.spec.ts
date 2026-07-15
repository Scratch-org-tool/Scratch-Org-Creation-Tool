import { describe, expect, it, vi } from 'vitest';
import type { QueueService } from '../queue/queue.service';
import { AuthAuditService } from './auth-audit.service';
import { AuthSecurityService } from './auth-security.service';

const createAuditEvent = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock('@sfcc/db', () => ({
  prisma: {
    authAuditEvent: {
      create: createAuditEvent,
    },
  },
}));

describe('AuthAuditService', () => {
  it('stores hashes and strips secret-like metadata keys', async () => {
    const security = new AuthSecurityService({
      getConnection: () => null,
    } as unknown as QueueService);
    const audit = new AuthAuditService(security);

    await audit.record(
      'DPT_uid-1',
      'password_change_failed',
      { ip: '203.0.113.60', userAgent: 'raw-browser-agent' },
      {
        reason: 'current_credentials',
        password: 'must-not-store',
        tokenHint: 'must-not-store',
        rawIp: '203.0.113.60',
      },
    );

    const data = createAuditEvent.mock.calls[0]?.[0].data;
    expect(data.userId).toBe('DPT_uid-1');
    expect(data.ipHash).not.toContain('203.0.113.60');
    expect(data.userAgentHash).not.toContain('raw-browser-agent');
    expect(data.metadata).toEqual({ reason: 'current_credentials' });
    expect(JSON.stringify(data)).not.toContain('must-not-store');
  });
});
