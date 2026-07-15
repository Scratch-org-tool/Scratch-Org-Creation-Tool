import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FirebaseIdentityError,
  FirebaseIdentityService,
} from './firebase-identity.service';

describe('FirebaseIdentityService current-password verification', () => {
  const originalApiKey = process.env.FIREBASE_WEB_API_KEY;

  beforeEach(() => {
    process.env.FIREBASE_WEB_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalApiKey === undefined) delete process.env.FIREBASE_WEB_API_KEY;
    else process.env.FIREBASE_WEB_API_KEY = originalApiKey;
  });

  it('reauthenticates using only the verified token email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        idToken: 'firebase-id-token',
        refreshToken: 'firebase-refresh-token',
        localId: 'uid-1',
        email: 'token-email@example.test',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new FirebaseIdentityService().verifyCurrentPassword(
      'token-email@example.test',
      'CurrentPassword1!',
      'uid-1',
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      email: 'token-email@example.test',
      password: 'CurrentPassword1!',
      returnSecureToken: true,
    });
  });

  it('rejects a Firebase identity that does not match the token uid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        idToken: 'id-token',
        refreshToken: 'refresh-token',
        localId: 'different-uid',
        email: 'token-email@example.test',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));

    await expect(
      new FirebaseIdentityService().verifyCurrentPassword(
        'token-email@example.test',
        'CurrentPassword1!',
        'uid-1',
      ),
    ).rejects.toEqual(new FirebaseIdentityError('INVALID_PASSWORD'));
  });

  it('logs only normalized Firebase error codes, never password or tokens', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: {
          message: 'INVALID_PASSWORD: CurrentPassword1! firebase-secret-token',
        },
      }), { status: 400, headers: { 'Content-Type': 'application/json' } }),
    ));

    await expect(
      new FirebaseIdentityService().verifyCurrentPassword(
        'token-email@example.test',
        'CurrentPassword1!',
        'uid-1',
      ),
    ).rejects.toBeInstanceOf(FirebaseIdentityError);
    const logs = JSON.stringify(warn.mock.calls);
    expect(logs).toContain('INVALID_PASSWORD');
    expect(logs).not.toContain('CurrentPassword1!');
    expect(logs).not.toContain('firebase-secret-token');
  });
});
