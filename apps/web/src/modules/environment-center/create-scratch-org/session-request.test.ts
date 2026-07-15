import { describe, expect, it, vi } from 'vitest';
import { sessionRequest } from './session-request';

describe('sessionRequest', () => {
  it('deduplicates a Strict Mode bootstrap request across remounts', async () => {
    const request = vi.fn().mockResolvedValue(['dev-hub']);
    const key = `strict-mode-${Math.random()}`;

    const firstMount = sessionRequest(key, request);
    const secondMount = sessionRequest(key, request);

    await expect(Promise.all([firstMount, secondMount])).resolves.toEqual([
      ['dev-hub'],
      ['dev-hub'],
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    await expect(sessionRequest(key, request)).resolves.toEqual(['dev-hub']);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('allows a later mount to retry a failed request', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(['dev-hub']);
    const key = `retry-${Math.random()}`;

    await expect(sessionRequest(key, request)).rejects.toThrow('temporary');
    await expect(sessionRequest(key, request)).resolves.toEqual(['dev-hub']);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
