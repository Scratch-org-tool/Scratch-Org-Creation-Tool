import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_ACCESS_LAST_ADMIN, AUTH_ACCESS_SELF_FORBIDDEN } from '@sfcc/shared';
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
  getAppUser: vi.fn(),
  getAppUserByFirebaseUid: vi.fn(),
  countActiveAdminUsers: vi.fn(),
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

  it('returns 503 without touching either profile when the distributed lock fails', async () => {
    security.withAccountMutationLock.mockRejectedValue(
      new Error('Account profile update lock unavailable'),
    );

    await expect(
      service.updateMe(
        'uid-1',
        profile.id,
        { displayName: 'New Name' },
        { ip: '203.0.113.10' },
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(firebaseAdmin.updateFirebaseAuthDisplayName).not.toHaveBeenCalled();
    expect(users.updateAppUser).not.toHaveBeenCalled();
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

describe('AuthService admin user access', () => {
  const admin = {
    id: 'DPT_admin',
    email: 'admin@example.test',
    displayName: 'Admin',
    role: 'admin' as const,
    grantedModules: [],
    status: 'active' as const,
    lastActiveAt: null,
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  };
  const otherAdmin = { ...admin, id: 'DPT_other-admin', email: 'other@example.test' };
  const regular = { ...admin, id: 'DPT_user', email: 'user@example.test', role: 'user' as const };
  const context = { ip: '203.0.113.10', userAgent: 'spec-agent' };

  let audit: { record: ReturnType<typeof vi.fn>; listEvents: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    users.getAppUserByFirebaseUid.mockResolvedValue(admin);
    users.countActiveAdminUsers.mockResolvedValue(2);
    audit = {
      record: vi.fn().mockResolvedValue(undefined),
      listEvents: vi
        .fn()
        .mockResolvedValue({ events: [], total: 0, limit: 25, offset: 0 }),
    };
    service = new AuthService(
      {} as unknown as FirebaseIdentityService,
      {} as unknown as AuthSecurityService,
      audit as unknown as AuthAuditService,
    );
  });

  it('rejects a non-admin requester', async () => {
    users.getAppUserByFirebaseUid.mockResolvedValue(regular);
    await expect(
      service.updateUserAccess('uid', otherAdmin.id, { role: 'user' }, context),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.updateAppUser).not.toHaveBeenCalled();
  });

  it('returns 404 when the target user does not exist', async () => {
    users.getAppUser.mockResolvedValue(null);
    await expect(
      service.updateUserAccess('uid', 'DPT_missing', { role: 'user' }, context),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids an admin from changing their own access and audits the denial', async () => {
    users.getAppUser.mockResolvedValue(admin);
    await expect(
      service.updateUserAccess('uid', admin.id, { role: 'user' }, context),
    ).rejects.toMatchObject({ message: AUTH_ACCESS_SELF_FORBIDDEN });
    expect(users.updateAppUser).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      admin.id,
      'user_access_update_denied',
      expect.anything(),
      expect.objectContaining({ reason: 'self' }),
    );
  });

  it('blocks demoting the last active admin', async () => {
    users.getAppUser.mockResolvedValue(otherAdmin);
    users.countActiveAdminUsers.mockResolvedValue(1);
    await expect(
      service.updateUserAccess('uid', otherAdmin.id, { role: 'user' }, context),
    ).rejects.toMatchObject({ message: AUTH_ACCESS_LAST_ADMIN });
    expect(users.updateAppUser).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      admin.id,
      'user_access_update_denied',
      expect.anything(),
      expect.objectContaining({ reason: 'last_admin' }),
    );
  });

  it('blocks deactivating the last active admin', async () => {
    users.getAppUser.mockResolvedValue(otherAdmin);
    users.countActiveAdminUsers.mockResolvedValue(1);
    await expect(
      service.updateUserAccess('uid', otherAdmin.id, { status: 'inactive' }, context),
    ).rejects.toMatchObject({ message: AUTH_ACCESS_LAST_ADMIN });
  });

  it('demotes an admin when others remain and records the change with the actor', async () => {
    users.getAppUser.mockResolvedValue(otherAdmin);
    users.countActiveAdminUsers.mockResolvedValue(2);
    users.updateAppUser.mockResolvedValue({ ...otherAdmin, role: 'user' });

    const result = await service.updateUserAccess(
      'uid',
      otherAdmin.id,
      { role: 'user' },
      context,
    );

    expect(users.updateAppUser).toHaveBeenCalledWith(otherAdmin.id, { role: 'user' });
    expect(result).toMatchObject({ role: 'user' });
    expect(audit.record).toHaveBeenCalledWith(
      otherAdmin.id,
      'user_access_updated',
      expect.anything(),
      expect.objectContaining({ actorId: admin.id, roleChanged: true }),
    );
  });

  it('updates a standard user and reports module changes without leaking PII', async () => {
    users.getAppUser.mockResolvedValue(regular);
    users.updateAppUser.mockResolvedValue({ ...regular, grantedModules: ['deployment'] });

    const result = await service.updateUserAccess(
      'uid',
      regular.id,
      { grantedModules: ['deployment'] },
      context,
    );

    expect(result.grantedModules).toEqual(['deployment']);
    expect(audit.record).toHaveBeenCalledWith(
      regular.id,
      'user_access_updated',
      expect.anything(),
      expect.objectContaining({ modulesChanged: true, moduleCount: 1 }),
    );
    // The metadata payload we build must never carry raw request identifiers
    // (the IP/UA context is hashed inside AuthAuditService, not stored here).
    const recordedMetadata = JSON.stringify(audit.record.mock.calls.at(-1)?.[3]);
    expect(recordedMetadata).not.toContain('203.0.113.10');
    expect(recordedMetadata).not.toContain('spec-agent');
  });

  it('lists audit events for admins and forbids non-admins', async () => {
    await service.listAuditEvents('uid', { limit: 25, offset: 0 });
    expect(audit.listEvents).toHaveBeenCalledWith({ limit: 25, offset: 0 });

    users.getAppUserByFirebaseUid.mockResolvedValue(regular);
    await expect(
      service.listAuditEvents('uid', { limit: 25, offset: 0 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('derives overview stats from a single user fetch', async () => {
    users.listAppUsers.mockResolvedValue([admin, otherAdmin, regular]);
    const overview = await service.getUsersOverview('uid');
    expect(users.listAppUsers).toHaveBeenCalledTimes(1);
    expect(overview.stats.total).toBe(3);
    expect(overview.stats.admins).toBe(2);
    expect(overview.users).toHaveLength(3);
  });
});
