import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../../common/auth.guard';
import { AuthController } from './auth.controller';
import type { AuthSecurityService } from './auth-security.service';
import type { AuthService } from './auth.service';

describe('AuthController self-service account contracts', () => {
  const request: AuthenticatedRequest = {
    headers: { 'user-agent': 'browser-test' },
    query: {},
    ip: '203.0.113.40',
    user: {
      uid: 'firebase-uid',
      appUserId: 'DPT_firebase-uid',
      email: 'token-email@example.test',
    },
  };
  let auth: {
    updateMe: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    logoutAll: ReturnType<typeof vi.fn>;
    auditRejectedAccountRequest: ReturnType<typeof vi.fn>;
  };
  let controller: AuthController;

  beforeEach(() => {
    auth = {
      updateMe: vi.fn().mockResolvedValue({}),
      changePassword: vi.fn().mockResolvedValue({ reauthenticationRequired: true }),
      logoutAll: vi.fn().mockResolvedValue({ reauthenticationRequired: true }),
      auditRejectedAccountRequest: vi.fn().mockResolvedValue(undefined),
    };
    const security = {
      extractClientIp: vi.fn((_headers, ip) => ip ?? 'unknown'),
    } as unknown as AuthSecurityService;
    controller = new AuthController(auth as unknown as AuthService, security);
  });

  it('sanitizes displayName before passing only authenticated identifiers', async () => {
    await controller.updateMe(request, {
      displayName: '  Ada   <b>Lovelace</b> ',
    });

    expect(auth.updateMe).toHaveBeenCalledWith(
      'firebase-uid',
      'DPT_firebase-uid',
      { displayName: 'Ada Lovelace' },
      {
        ip: '203.0.113.40',
        userAgent: 'browser-test',
      },
    );
  });

  it.each(['role', 'status', 'modules', 'grantedModules', 'email'])(
    'strictly rejects self-service profile field %s',
    async (field) => {
      await expect(
        controller.updateMe(request, {
          displayName: 'Ada',
          [field]: field === 'email' ? 'attacker@example.test' : 'admin',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(auth.updateMe).not.toHaveBeenCalled();
      expect(auth.auditRejectedAccountRequest).toHaveBeenCalledWith(
        'profile-update',
        'DPT_firebase-uid',
        expect.anything(),
      );
    },
  );

  it('never accepts a body email for password verification', async () => {
    await expect(
      controller.changePassword(request, {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword2!',
        confirmPassword: 'NewPassword2!',
        email: 'attacker@example.test',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(auth.changePassword).not.toHaveBeenCalled();

    await controller.changePassword(request, {
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword2!',
      confirmPassword: 'NewPassword2!',
    });
    expect(auth.changePassword).toHaveBeenCalledWith(
      'firebase-uid',
      'DPT_firebase-uid',
      'token-email@example.test',
      expect.anything(),
      expect.anything(),
    );
  });

  it('uses the resolved legacy AppUser ID for rejected-request audits', async () => {
    const legacyRequest: AuthenticatedRequest = {
      ...request,
      userProfile: {
        id: 'firebase-uid',
        email: request.user!.email,
        displayName: 'Legacy User',
        role: 'user',
        grantedModules: [],
        status: 'active',
      },
    };

    await expect(
      controller.changePassword(legacyRequest, {
        currentPassword: 'invalid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(auth.auditRejectedAccountRequest).toHaveBeenCalledWith(
      'change-password',
      'firebase-uid',
      expect.anything(),
    );
  });

  it('rejects targeting fields on logout-all', async () => {
    await expect(
      controller.logoutAll(request, { uid: 'another-user' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(auth.logoutAll).not.toHaveBeenCalled();
  });
});
