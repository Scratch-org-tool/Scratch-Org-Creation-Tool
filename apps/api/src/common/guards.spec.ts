import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import {
  APP_MODULES,
  resolveCopilotTiers,
  resolveRole,
  canAccessModule,
  getEffectiveModules,
  sanitizeNextRedirect,
  type UserAccessProfile,
} from '@sfcc/shared';
import { RoleGuard } from './role.guard';
import { ModuleGuard } from './module.guard';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard';
import { AuthSecurityService } from '../modules/auth/auth-security.service';

vi.mock('@sfcc/firebase', () => ({
  verifyIdToken: vi.fn(),
}));

import { verifyIdToken } from '@sfcc/firebase';

function makeContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Ctrl {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function fakeReflector(value: unknown): Reflector {
  return { getAllAndOverride: () => value } as unknown as Reflector;
}

function profile(over: Partial<UserAccessProfile> = {}): UserAccessProfile {
  return {
    id: 'DPT_u1',
    email: 'user@example.com',
    displayName: 'User',
    role: 'user',
    grantedModules: [],
    status: 'active',
    ...over,
  };
}

describe('RoleGuard', () => {
  it('allows routes without a role requirement', () => {
    const guard = new RoleGuard(fakeReflector(undefined));
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('rejects non-admin users on admin-only routes', () => {
    const guard = new RoleGuard(fakeReflector('admin'));
    const ctx = makeContext({ userProfile: profile({ role: 'user' }) });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects unauthenticated requests on admin-only routes', () => {
    const guard = new RoleGuard(fakeReflector('admin'));
    expect(() => guard.canActivate(makeContext({}))).toThrow(ForbiddenException);
  });

  it('allows admins on admin-only routes', () => {
    const guard = new RoleGuard(fakeReflector('admin'));
    const ctx = makeContext({ userProfile: profile({ role: 'admin' }) });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

describe('ModuleGuard', () => {
  it('rejects users without the module grant', () => {
    const guard = new ModuleGuard(fakeReflector('copilot'));
    const ctx = makeContext({ userProfile: profile() });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows users with an explicit grant', () => {
    const guard = new ModuleGuard(fakeReflector('copilot'));
    const ctx = makeContext({ userProfile: profile({ grantedModules: ['copilot'] }) });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows admins on every module', () => {
    const guard = new ModuleGuard(fakeReflector('copilot'));
    const ctx = makeContext({ userProfile: profile({ role: 'admin' }) });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

describe('AuthGuard', () => {
  const getProfileByFirebaseUid = vi.fn();
  const makeGuard = () =>
    new AuthGuard(
      { getProfileByFirebaseUid } as never,
      fakeReflector(false),
    );

  beforeEach(() => {
    vi.mocked(verifyIdToken).mockReset();
    getProfileByFirebaseUid.mockReset();
  });

  it('rejects requests without a token', async () => {
    const guard = makeGuard();
    await expect(
      guard.canActivate(makeContext({ headers: {}, query: {} })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('does not accept Firebase ID tokens from query parameters', async () => {
    const guard = makeGuard();
    await expect(
      guard.canActivate(makeContext({ headers: {}, query: { token: 'firebase-id-token' } })),
    ).rejects.toThrow(UnauthorizedException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('blocks inactive users even with a valid token', async () => {
    vi.mocked(verifyIdToken).mockResolvedValue({ uid: 'u1', email: 'a@b.c' } as never);
    getProfileByFirebaseUid.mockResolvedValue(profile({ status: 'inactive' }));
    const guard = makeGuard();
    await expect(
      guard.canActivate(
        makeContext({ headers: { authorization: 'Bearer token' }, query: {} }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects unregistered users when registration is required', async () => {
    vi.mocked(verifyIdToken).mockResolvedValue({ uid: 'u1', email: 'a@b.c' } as never);
    getProfileByFirebaseUid.mockResolvedValue(null);
    const guard = makeGuard();
    await expect(
      guard.canActivate(
        makeContext({ headers: { authorization: 'Bearer token' }, query: {} }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('admits active registered users and attaches the profile', async () => {
    vi.mocked(verifyIdToken).mockResolvedValue({ uid: 'u1', email: 'a@b.c' } as never);
    getProfileByFirebaseUid.mockResolvedValue(profile());
    const guard = makeGuard();
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Bearer token' },
      query: {},
    };
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('token', true);
    expect(request.user?.appUserId).toBe('DPT_u1');
    expect(request.userProfile?.status).toBe('active');
  });

  it('maps revoked Firebase tokens to the stable unauthorized response', async () => {
    vi.mocked(verifyIdToken).mockRejectedValue(
      Object.assign(new Error('Firebase ID token has been revoked'), {
        code: 'auth/id-token-revoked',
      }),
    );
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const guard = makeGuard();

    await expect(
      guard.canActivate(
        makeContext({ headers: { authorization: 'Bearer revoked' }, query: {} }),
      ),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        message: 'Invalid or expired authentication token',
      },
    });
    expect(verifyIdToken).toHaveBeenCalledWith('revoked', true);
    expect(getProfileByFirebaseUid).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });
});

describe('copilot knowledge tiers', () => {
  it('gives admins both tiers', () => {
    expect(resolveCopilotTiers(profile({ role: 'admin' }))).toEqual(['app_guide', 'internal']);
  });

  it('gives granted users only the app-guide tier', () => {
    expect(resolveCopilotTiers(profile({ grantedModules: ['copilot'] }))).toEqual(['app_guide']);
  });

  it('gives non-granted users and anonymous callers nothing', () => {
    expect(resolveCopilotTiers(profile())).toEqual([]);
    expect(resolveCopilotTiers(null)).toEqual([]);
    expect(resolveCopilotTiers(undefined)).toEqual([]);
  });
});

describe('admin elevation', () => {
  it('requires the server-side allowlist AND the confirmation text', () => {
    expect(resolveRole('admin@corp.com', 'admin', true)).toBe('admin');
    expect(resolveRole('admin@corp.com', 'admin', false)).toBe('user');
    expect(resolveRole('admin@corp.com', undefined, true)).toBe('user');
    expect(resolveRole('admin@evil.com', 'admin', false)).toBe('user');
  });
});

describe('module resolution', () => {
  it('locked modules require an explicit grant for regular users', () => {
    expect(canAccessModule(profile(), 'deployment')).toBe(false);
    expect(canAccessModule(profile({ grantedModules: ['deployment'] }), 'deployment')).toBe(true);
  });

  it('keeps only the dashboard as standard-user default access', () => {
    const modules = getEffectiveModules(profile());
    expect(modules).toEqual(['dashboard']);
    for (const module of APP_MODULES.filter((candidate) => candidate !== 'dashboard')) {
      expect(canAccessModule(profile(), module)).toBe(false);
    }
  });

  it('requires explicit grants for calendar, environment, data, defects, and learning', () => {
    const granted = ['calendar', 'environment', 'data', 'defects', 'learning'] as const;
    for (const module of granted) {
      expect(canAccessModule(profile(), module)).toBe(false);
      expect(canAccessModule(profile({ grantedModules: [module] }), module)).toBe(true);
    }
  });
});

describe('client IP resolution', () => {
  it('ignores untrusted X-Forwarded-For values', () => {
    const security = new AuthSecurityService({} as never);
    expect(
      security.extractClientIp(
        { 'x-forwarded-for': '203.0.113.9' },
        '192.0.2.10',
      ),
    ).toBe('192.0.2.10');
  });
});

describe('post-login redirects', () => {
  it('allows local paths and rejects external or encoded bypasses', () => {
    expect(sanitizeNextRedirect('/data-center?tab=cona#runs')).toBe(
      '/data-center?tab=cona#runs',
    );
    expect(sanitizeNextRedirect('https://evil.example')).toBe('/dashboard');
    expect(sanitizeNextRedirect('//evil.example/path')).toBe('/dashboard');
    expect(sanitizeNextRedirect('/%2f%2fevil.example')).toBe('/dashboard');
    expect(sanitizeNextRedirect('/%5cevil.example')).toBe('/dashboard');
  });
});
