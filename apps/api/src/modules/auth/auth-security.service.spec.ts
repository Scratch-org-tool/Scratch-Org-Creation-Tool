import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueService } from '../queue/queue.service';
import { AuthSecurityService } from './auth-security.service';

describe('AuthSecurityService account action controls', () => {
  let service: AuthSecurityService;

  beforeEach(() => {
    service = new AuthSecurityService({
      getConnection: () => null,
    } as unknown as QueueService);
  });

  it('keys change-password limits by user and trusted request IP', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.checkAccountRateLimit(
          'DPT_uid-1',
          '203.0.113.50',
          'change-password',
        ),
      ).resolves.toBe(true);
    }
    await expect(
      service.checkAccountRateLimit(
        'DPT_uid-1',
        '203.0.113.50',
        'change-password',
      ),
    ).resolves.toBe(false);
    await expect(
      service.checkAccountRateLimit(
        'DPT_uid-1',
        '203.0.113.51',
        'change-password',
      ),
    ).resolves.toBe(true);
  });

  it('applies progressive delays and clears action failures', async () => {
    await service.recordAccountActionFailure(
      'DPT_uid-1',
      '203.0.113.50',
      'change-password',
    );
    await service.recordAccountActionFailure(
      'DPT_uid-1',
      '203.0.113.50',
      'change-password',
    );
    await expect(
      service.getAccountActionDelayMs(
        'DPT_uid-1',
        '203.0.113.50',
        'change-password',
      ),
    ).resolves.toBe(1000);

    await service.clearAccountActionFailures(
      'DPT_uid-1',
      '203.0.113.50',
      'change-password',
    );
    await expect(
      service.getAccountActionDelayMs(
        'DPT_uid-1',
        '203.0.113.50',
        'change-password',
      ),
    ).resolves.toBe(0);
  });

  it('ignores spoofable forwarding headers and never logs the raw IP', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    expect(
      service.extractClientIp(
        { 'x-forwarded-for': '198.51.100.99' },
        '203.0.113.50',
      ),
    ).toBe('203.0.113.50');

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await service.checkAccountRateLimit(
        'DPT_uid-1',
        '203.0.113.50',
        'change-password',
      );
    }
    expect(JSON.stringify(warn.mock.calls)).not.toContain('203.0.113.50');
  });
});
