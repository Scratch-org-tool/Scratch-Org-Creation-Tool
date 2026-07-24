import { describe, expect, it, vi } from 'vitest';
import { describeSfCliAccessError, resolveSfCliTarget } from './sf-cli-org.util';

describe('sf-cli-org util', () => {
  it('describes expired scratch org CLI failures', () => {
    expect(describeSfCliAccessError(
      'HTTP response contains html content. HTTP status code: 420.',
    )).toContain('scratch org is no longer active');
  });

  it('resolves a working CLI target from username or alias', async () => {
    const sfCli = {
      getOrgDisplay: vi.fn()
        .mockResolvedValueOnce({ success: false, error: 'No authorization' })
        .mockResolvedValueOnce({ success: true, data: { result: {} } }),
    };

    await expect(resolveSfCliTarget(sfCli, {
      alias: 'dev3',
      username: 'user@scratch.com',
    })).resolves.toBe('dev3');
  });

  it('throws a reconnect message when every CLI target fails', async () => {
    const sfCli = {
      getOrgDisplay: vi.fn().mockResolvedValue({
        success: false,
        error: 'HTTP response contains html content. HTTP status code: 420.',
      }),
    };

    await expect(resolveSfCliTarget(sfCli, {
      alias: 'dev2',
      username: 'sprint1scratchfordev@scratch.com',
    }, 'Source org')).rejects.toThrow(/connected in the app but Salesforce CLI cannot access it/i);
  });
});
