import { BadRequestException, ForbiddenException, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthAuditService } from './auth-audit.service';
import type { AuthSecurityService } from './auth-security.service';
import type { FirebaseIdentityService } from './firebase-identity.service';

const firebaseAdmin = vi.hoisted(() => ({
  createCustomTokenForUid: vi.fn(),
  updateFirebaseAuthDisplayName: vi.fn(),
  updateFirebaseAuthPassword: vi.fn(),
  revokeFirebaseRefreshTokens: vi.fn(),
}));

const users = vi.hoisted(() => ({
  getAppUserByFirebaseUid: vi.fn(),
  getUserAccessStats: vi.fn(),
  listAppUsers: vi.fn(),
  touchLastActive: vi.fn(),
  updateAppUser: vi.fn(),
  upsertAppUser: vi.fn(),
}));

vi.mock('@sfcc/firebase', () => firebaseAdmin);
vi.mock('./app-user.service', () => users);

import { AuthService } from './auth.service';

const profile = {
  id: 'DPT_uid-1',
  email: 'ada@example.test',
  displayName: 'Ada',
  role: 'user' as const,
  grantedModules: [],
  status: 'active' as const,
  lastActiveAt: null,
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
};

describe('AuthService self-service accounts', () => {
  let identity: {
    verifyCurrentPassword: ReturnType<typeof vi.fn>;
  };
  let security: {
    checkAccountRateLimit: ReturnType<typeof vi.fn>;
    getAccountActionDelayMs: ReturnType<typeof vi.fn>;
    recordAccountActionFailure: ReturnType<typeof vi.fn>;
    clearAccountActionFailures: ReturnType<typeof vi.fn>;
    clearLoginFailures: ReturnType<typeof vi.fn>;
    hashEmail: ReturnType<typeof vi.fn>;
    sleep: ReturnType<typeof vi.fn>;
    withAccountMutationLock: ReturnType<typeof vi.fn>;
  };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    users.getAppUserByFirebaseUid.mockResolvedValue(profile);
    users.updateAppUser.mockResolvedValue(profile);
    firebaseAdmin.updateFirebaseAuthDisplayName.mockResolvedValue(undefined);
    firebaseAdmin.updateFirebaseAuthPassword.mockResolvedValue(undefined);
    firebaseAdmin.revokeFirebaseRefreshTokens.mockResolvedValue(undefined);
    identity = {
      verifyCurrentPassword: vi.fn().mockResolvedValue({
        localId: 'uid-1',
        email: profile.email,
      }),
    };
    security = {
      checkAccountRateLimit: vi.fn().mockResolvedValue(true),
      getAccountActionDelayMs: vi.fn().mockResolvedValue(0),
      recordAccountActionFailure: vi.fn().mockResolvedValue(1),
      clearAccountActionFailures: vi.fn().mockResolvedValue(undefined),
      clearLoginFailures: vi.fn().mockResolvedValue(undefined),
      hashEmail: vi.fn().mockReturnValue('email-hash'),
      sleep: vi.fn().mockResolvedValue(undefined),
      withAccountMutationLock: vi.fn(
        async (_userId: string, operation: () => Promise<unknown>) => operation(),
      ),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      identity as unknown as FirebaseIdentityService,
      security as unknown as AuthSecurityService,
      audit as unknown as AuthAuditService,
    );
  });

  it('updates only the authenticated account in Firebase and AppUser', async () => {
    const updated = { ...profile, displayName: 'Ada Lovelace' };
    users.updateAppUser.mockResolvedValue(updated);

    const result = await service.updateMe(
      'uid-1',
      'DPT_uid-1',
      { displayName: 'Ada Lovelace' },
      { ip: '203.0.113.10' },
    );

    expect(firebaseAdmin.updateFirebaseAuthDisplayName).toHaveBeenCalledWith(
      'uid-1',
      'Ada Lovelace',
    );
    expect(users.updateAppUser).toHaveBeenCalledWith('DPT_uid-1', {
      displayName: 'Ada Lovelace',
    });
    expect(result).toMatchObject({
      displayName: 'Ada Lovelace',
      effectiveModules: expect.any(Array),
    });
  });

  it('compensates Firebase when the AppUser update fails', async () => {
    users.updateAppUser.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.updateMe(
        'uid-1',
        'DPT_uid-1',
        { displayName: 'New Name' },
        { ip: '203.0.113.10' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(firebaseAdmin.updateFirebaseAuthDisplayName.mock.calls).toEqual([
      ['uid-1', 'New Name'],
      ['uid-1', 'Ada'],
    ]);
    expect(audit.record).toHaveBeenCalledWith(
      profile.id,
      'profile_update_failed',
      expect.anything(),
      expect.objectContaining({ compensated: true }),
    );
  });

  it('serializes concurrent updates so older compensation cannot overwrite the latest name', async () => {
    let lockTail = Promise.resolve();
    security.withAccountMutationLock.mockImplementation(
      async (_userId: string, operation: () => Promise<unknown>) => {
        const previous = lockTail;
        let releaseLock!: () => void;
        lockTail = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        await previous;
        try {
          return await operation();
        } finally {
          releaseLock();
        }
      },
    );

    let rejectFirstUpdate!: (error: Error) => void;
    const firstUpdate = new Promise<never>((_resolve, reject) => {
      rejectFirstUpdate = reject;
    });
    const latest = { ...profile, displayName: 'Latest Name' };
    users.updateAppUser
      .mockImplementationOnce(() => firstUpdate)
      .mockResolvedValueOnce(latest);

    const olderRequest = service.updateMe(
      'uid-1',
      profile.id,
      { displayName: 'Older Name' },
      { ip: '203.0.113.10' },
    );
    await vi.waitFor(() => expect(users.updateAppUser).toHaveBeenCalledTimes(1));

    const latestRequest = service.updateMe(
      'uid-1',
      profile.id,
      { displayName: 'Latest Name' },
      { ip: '203.0.113.11' },
    );
    await Promise.resolve();
    expect(firebaseAdmin.updateFirebaseAuthDisplayName.mock.calls).toEqual([
      ['uid-1', 'Older Name'],
    ]);

    rejectFirstUpdate(new Error('database unavailable'));
    await expect(olderRequest).rejects.toBeInstanceOf(BadRequestException);
    await expect(latestRequest).resolves.toMatchObject({
      displayName: 'Latest Name',
    });

    expect(firebaseAdmin.updateFirebaseAuthDisplayName.mock.calls).toEqual([
      ['uid-1', 'Older Name'],
      ['uid-1', 'Ada'],
      ['uid-1', 'Latest Name'],
    ]);
  });

  it('reconciles failed compensation from the latest authoritative profile', async () => {
    let authoritativeName = profile.displayName;
    users.getAppUserByFirebaseUid.mockImplementation(async () => ({
      ...profile,
      displayName: authoritativeName,
    }));
    let rejectOlderUpdate!: (error: Error) => void;
    const olderUpdate = new Promise<never>((_resolve, reject) => {
      rejectOlderUpdate = reject;
    });
    users.updateAppUser
      .mockImplementationOnce(() => olderUpdate)
      .mockImplementationOnce(async (_id, update) => {
        authoritativeName = update.displayName!;
        return { ...profile, displayName: authoritativeName };
      });

    const olderRequest = service.updateMe(
      'uid-1',
      profile.id,
      { displayName: 'Older Name' },
      { ip: '203.0.113.10' },
    );
    await vi.waitFor(() => expect(users.updateAppUser).toHaveBeenCalledTimes(1));
    await expect(
      service.updateMe(
        'uid-1',
        profile.id,
        { displayName: 'Latest Name' },
        { ip: '203.0.113.11' },
      ),
    ).resolves.toMatchObject({ displayName: 'Latest Name' });

    rejectOlderUpdate(new Error('database unavailable'));
    await expect(olderRequest).rejects.toBeInstanceOf(BadRequestException);
    expect(firebaseAdmin.updateFirebaseAuthDisplayName.mock.calls).toEqual([
      ['uid-1', 'Older Name'],
      ['uid-1', 'Latest Name'],
      ['uid-1', 'Latest Name'],
    ]);
  });

  it('fails closed for an inactive account before touching Firebase', async () => {
    users.getAppUserByFirebaseUid.mockResolvedValue({
      ...profile,
      status: 'inactive',
    });

    await expect(
      service.updateMe(
        'uid-1',
        'DPT_uid-1',
        { displayName: 'New Name' },
        { ip: '203.0.113.10' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(firebaseAdmin.updateFirebaseAuthDisplayName).not.toHaveBeenCalled();
  });

  it('uses token email for current-password verification and revokes sessions', async () => {
    const result = await service.changePassword(
      'uid-1',
      'DPT_uid-1',
      'ada@example.test',
      {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword2!',
        confirmPassword: 'NewPassword2!',
      },
      { ip: '203.0.113.10', userAgent: 'test-agent' },
    );

    expect(identity.verifyCurrentPassword).toHaveBeenCalledWith(
      'ada@example.test',
      'OldPassword1!',
      'uid-1',
    );
    expect(firebaseAdmin.updateFirebaseAuthPassword).toHaveBeenCalledWith(
      'uid-1',
      'NewPassword2!',
    );
    expect(firebaseAdmin.revokeFirebaseRefreshTokens).toHaveBeenCalledWith('uid-1');
    expect(security.clearLoginFailures).toHaveBeenCalledWith('email-hash');
    expect(result.reauthenticationRequired).toBe(true);
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('Password');
  });

  it('returns a generic failure for a wrong current password', async () => {
    identity.verifyCurrentPassword.mockRejectedValue(new Error('INVALID_PASSWORD'));

    await expect(
      service.changePassword(
        'uid-1',
        'DPT_uid-1',
        'ada@example.test',
        {
          currentPassword: 'WrongPassword1!',
          newPassword: 'NewPassword2!',
          confirmPassword: 'NewPassword2!',
        },
        { ip: '203.0.113.10' },
      ),
    ).rejects.toMatchObject({
      message: 'Unable to complete this account request. Please try again.',
    });
    expect(firebaseAdmin.updateFirebaseAuthPassword).not.toHaveBeenCalled();
    expect(firebaseAdmin.revokeFirebaseRefreshTokens).not.toHaveBeenCalled();
    expect(security.recordAccountActionFailure).toHaveBeenCalled();
  });

  it('requires reauthentication if password changed but session revocation needs reconciliation', async () => {
    firebaseAdmin.revokeFirebaseRefreshTokens.mockRejectedValue(
      new Error('firebase unavailable'),
    );

    await expect(
      service.changePassword(
        'uid-1',
        'DPT_uid-1',
        profile.email,
        {
          currentPassword: 'OldPassword1!',
          newPassword: 'NewPassword2!',
          confirmPassword: 'NewPassword2!',
        },
        { ip: '203.0.113.10' },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Unable to complete this account request. Please try again.',
        reauthenticationRequired: true,
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      profile.id,
      'password_change_success',
      expect.anything(),
      expect.objectContaining({ reconciliationRequired: true }),
    );
  });

  it('returns password-change success after revocation when cleanup and audit fail', async () => {
    security.clearLoginFailures.mockRejectedValue(new Error('redis unavailable'));
    audit.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.changePassword(
        'uid-1',
        profile.id,
        profile.email,
        {
          currentPassword: 'OldPassword1!',
          newPassword: 'NewPassword2!',
          confirmPassword: 'NewPassword2!',
        },
        { ip: '203.0.113.10' },
      ),
    ).resolves.toEqual({
      message: 'Password changed. Sign in again on all devices.',
      reauthenticationRequired: true,
    });
    expect(firebaseAdmin.revokeFirebaseRefreshTokens).toHaveBeenCalledWith('uid-1');
  });

  it('rate limits by authenticated user and trusted request IP', async () => {
    security.checkAccountRateLimit.mockResolvedValue(false);

    const request = service.changePassword(
      'uid-1',
      'DPT_uid-1',
      profile.email,
      {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword2!',
        confirmPassword: 'NewPassword2!',
      },
      { ip: '198.51.100.20' },
    );
    await expect(request).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'AUTH_RATE_LIMITED',
        message: 'Unable to complete this account request. Please try again.',
      },
    });
    expect(security.checkAccountRateLimit).toHaveBeenCalledWith(
      profile.id,
      '198.51.100.20',
      'change-password',
    );
    expect(identity.verifyCurrentPassword).not.toHaveBeenCalled();
  });

  it('revokes all sessions for the authenticated account only', async () => {
    const result = await service.logoutAll(
      'uid-1',
      'DPT_uid-1',
      { ip: '203.0.113.10' },
    );

    expect(firebaseAdmin.revokeFirebaseRefreshTokens).toHaveBeenCalledWith('uid-1');
    expect(result.reauthenticationRequired).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      profile.id,
      'sessions_revoked',
      expect.anything(),
      { source: 'logout_all' },
    );
  });

  it('returns logout-all success after revocation when cleanup and audit fail', async () => {
    security.clearAccountActionFailures.mockRejectedValue(
      new Error('redis unavailable'),
    );
    audit.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.logoutAll(
        'uid-1',
        profile.id,
        { ip: '203.0.113.10' },
      ),
    ).resolves.toEqual({
      message: 'Signed out from all devices.',
      reauthenticationRequired: true,
    });
    expect(firebaseAdmin.revokeFirebaseRefreshTokens).toHaveBeenCalledWith('uid-1');
    expect(security.recordAccountActionFailure).not.toHaveBeenCalled();
  });
});
