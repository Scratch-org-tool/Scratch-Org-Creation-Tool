import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createCustomTokenForUid } from '@sfcc/firebase';
import {
  AUTH_GENERIC_INVALID,
  AUTH_LOGIN_FAILED,
  AUTH_RESET_SENT,
  AUTH_SIGNUP_FAILED,
  AUTH_EMAIL_EXISTS,
  AUTH_UNAVAILABLE,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterBodyInput,
  type SignupInput,
  getEffectiveModules,
  displayAccessRole,
  toAppUserId,
  type AppModule,
  type UserAccessStatus,
  type UserRole,
} from '@sfcc/shared';
import {
  getAppUserByFirebaseUid,
  getUserAccessStats,
  listAppUsers,
  touchLastActive,
  updateAppUser,
  upsertAppUser,
} from './app-user.service';
import { FirebaseIdentityError, FirebaseIdentityService } from './firebase-identity.service';
import { AuthSecurityService } from './auth-security.service';

function isAllowlistedAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

function provisionRole(email: string): UserRole {
  return isAllowlistedAdmin(email) ? 'admin' : 'user';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly firebaseIdentity: FirebaseIdentityService,
    private readonly authSecurity: AuthSecurityService,
  ) {}

  getProfileByFirebaseUid(firebaseUid: string) {
    return getAppUserByFirebaseUid(firebaseUid);
  }

  async loginWithCredentials(
    input: LoginInput,
    clientIp: string,
  ): Promise<{
    customToken?: string;
    profile: ReturnType<AuthService['toMeResponse']>;
    usePasswordSignIn?: boolean;
  }> {
    const emailHash = this.authSecurity.hashEmail(input.email);

    if (!(await this.authSecurity.checkIpRateLimit(clientIp, 'login'))) {
      throw new UnauthorizedException(AUTH_LOGIN_FAILED);
    }
    if (await this.authSecurity.isAccountLocked(emailHash)) {
      throw new UnauthorizedException(AUTH_LOGIN_FAILED);
    }

    const delayMs = await this.authSecurity.getProgressiveDelayMs(emailHash);
    await this.authSecurity.sleep(delayMs);

    try {
      const session = await this.firebaseIdentity.signInWithPassword(input.email, input.password);
      await this.authSecurity.clearLoginFailures(emailHash);

      const profile = await this.register(session.localId, session.email, {
        displayName: session.email.split('@')[0] ?? 'User',
        adminBootstrapToken: input.adminBootstrapToken,
      }, clientIp);

      try {
        const customToken = await createCustomTokenForUid(session.localId);
        return { customToken, profile };
      } catch (tokenErr) {
        this.logger.warn(
          `auth_login_password_fallback emailHash=${emailHash.slice(0, 12)} reason=${
            tokenErr instanceof Error ? tokenErr.message : 'unknown'
          }`,
        );
        return { profile, usePasswordSignIn: true };
      }
    } catch (err) {
      if (err instanceof FirebaseIdentityError) {
        const attempts = await this.authSecurity.recordLoginFailure(emailHash, clientIp);
        if (attempts >= 5) {
          try {
            await this.firebaseIdentity.sendPasswordResetEmail(input.email);
          } catch {
            this.logger.warn(`auth_lockout_reset_email_failed emailHash=${emailHash.slice(0, 12)}`);
          }
        }
        throw new UnauthorizedException(AUTH_LOGIN_FAILED);
      }
      if (err instanceof Error && err.message.includes('Firebase Admin')) {
        throw new BadRequestException(AUTH_UNAVAILABLE);
      }
      throw new UnauthorizedException(AUTH_LOGIN_FAILED);
    }
  }

  async signupWithCredentials(
    input: SignupInput,
    clientIp: string,
  ): Promise<{
    customToken?: string;
    profile: ReturnType<AuthService['toMeResponse']>;
    usePasswordSignIn?: boolean;
  }> {
    if (!(await this.authSecurity.checkIpRateLimit(clientIp, 'signup'))) {
      throw new BadRequestException(AUTH_SIGNUP_FAILED);
    }

    try {
      const session = await this.firebaseIdentity.signUp(
        input.email,
        input.password,
        input.displayName,
      );

      const profile = await this.register(session.localId, session.email, {
        displayName: input.displayName,
        adminBootstrapToken: input.adminBootstrapToken,
      }, clientIp);

      try {
        const customToken = await createCustomTokenForUid(session.localId);
        return { customToken, profile };
      } catch (tokenErr) {
        this.logger.warn(
          `auth_signup_password_fallback emailHash=${this.authSecurity.hashEmail(input.email).slice(0, 12)} reason=${
            tokenErr instanceof Error ? tokenErr.message : 'unknown'
          }`,
        );
        return { profile, usePasswordSignIn: true };
      }
    } catch (err) {
      if (err instanceof FirebaseIdentityError) {
        if (err.code === 'EMAIL_EXISTS') {
          throw new BadRequestException(AUTH_EMAIL_EXISTS);
        }
        throw new BadRequestException(AUTH_SIGNUP_FAILED);
      }
      if (err instanceof Error && err.message.includes('Firebase Admin')) {
        throw new BadRequestException(AUTH_UNAVAILABLE);
      }
      throw new BadRequestException(AUTH_SIGNUP_FAILED);
    }
  }

  async sendPasswordReset(input: ForgotPasswordInput, clientIp: string): Promise<{ message: string }> {
    if (!(await this.authSecurity.checkIpRateLimit(clientIp, 'forgot'))) {
      return { message: AUTH_RESET_SENT };
    }
    try {
      await this.firebaseIdentity.sendPasswordResetEmail(input.email);
    } catch {
      this.logger.warn(`auth_reset_request emailHash=${this.authSecurity.hashEmail(input.email).slice(0, 12)}`);
    }
    return { message: AUTH_RESET_SENT };
  }

  async register(
    firebaseUid: string,
    email: string,
    body: RegisterBodyInput,
    clientIp?: string,
  ) {
    const appUserId = toAppUserId(firebaseUid);
    const existing = await getAppUserByFirebaseUid(firebaseUid);
    const bootstrapValid = this.authSecurity.verifyBootstrapToken(body.adminBootstrapToken);

    if (body.adminBootstrapToken && !bootstrapValid) {
      if (clientIp) {
        if (!(await this.authSecurity.checkIpRateLimit(clientIp, 'bootstrap'))) {
          throw new BadRequestException(AUTH_GENERIC_INVALID);
        }
        await this.authSecurity.recordBootstrapFailure(clientIp);
      }
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }

    const targetRole = this.resolveTargetRole(email, bootstrapValid, existing?.role);

    if (existing) {
      if (bootstrapValid && existing.role !== 'admin') {
        const updated = await updateAppUser(existing.id, { role: 'admin' });
        await touchLastActive(existing.id);
        return this.toMeResponse(updated);
      }
      const touched = await touchLastActive(existing.id);
      return this.toMeResponse(touched);
    }

    const profile = await upsertAppUser({
      id: appUserId,
      email,
      displayName: body.displayName,
      role: targetRole,
      grantedModules: [],
    });
    await touchLastActive(appUserId);
    return this.toMeResponse(profile);
  }

  async claimAdmin(firebaseUid: string, _email: string, adminBootstrapToken: string, clientIp?: string) {
    if (!this.authSecurity.verifyBootstrapToken(adminBootstrapToken)) {
      if (clientIp) {
        if (!(await this.authSecurity.checkIpRateLimit(clientIp, 'bootstrap'))) {
          throw new BadRequestException(AUTH_GENERIC_INVALID);
        }
        await this.authSecurity.recordBootstrapFailure(clientIp);
      }
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }
    const existing = await getAppUserByFirebaseUid(firebaseUid);
    if (!existing) {
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }
    if (existing.role === 'admin') {
      return this.toMeResponse(existing);
    }
    const updated = await updateAppUser(existing.id, { role: 'admin' });
    return this.toMeResponse(updated);
  }

  private resolveTargetRole(
    email: string,
    bootstrapValid: boolean,
    existingRole?: UserRole,
  ): UserRole {
    if (bootstrapValid) return 'admin';
    if (provisionRole(email) === 'admin') return 'admin';
    return existingRole ?? 'user';
  }

  async getMe(firebaseUid: string) {
    const profile = await getAppUserByFirebaseUid(firebaseUid);
    if (!profile) {
      throw new ForbiddenException(AUTH_GENERIC_INVALID);
    }
    const touched = await touchLastActive(profile.id);
    return this.toMeResponse(touched);
  }

  async listUsers(requesterFirebaseUid: string) {
    await this.assertAdmin(requesterFirebaseUid);
    const users = await listAppUsers(true);
    return users.map((u) => this.toMeResponse(u));
  }

  async getUsersOverview(requesterFirebaseUid: string) {
    await this.assertAdmin(requesterFirebaseUid);
    const [stats, users] = await Promise.all([
      getUserAccessStats(true),
      listAppUsers(true),
    ]);
    return {
      stats,
      users: users.map((u) => this.toAccessRow(u)),
    };
  }

  async updateUserAccess(
    requesterFirebaseUid: string,
    targetUserId: string,
    body: { grantedModules?: AppModule[]; role?: UserRole; status?: UserAccessStatus },
  ) {
    await this.assertAdmin(requesterFirebaseUid);
    try {
      const updated = await updateAppUser(targetUserId, body);
      return this.toAccessRow(updated);
    } catch {
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }
  }

  private async assertAdmin(firebaseUid: string) {
    const profile = await getAppUserByFirebaseUid(firebaseUid);
    if (!profile || profile.role !== 'admin') {
      throw new ForbiddenException(AUTH_GENERIC_INVALID);
    }
  }

  private toMeResponse(profile: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    grantedModules: AppModule[];
    status?: UserAccessStatus;
    lastActiveAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }) {
    return {
      ...profile,
      effectiveModules: getEffectiveModules(profile),
    };
  }

  private toAccessRow(profile: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    grantedModules: AppModule[];
    status?: UserAccessStatus;
    lastActiveAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }) {
    return {
      ...this.toMeResponse(profile),
      displayRole: displayAccessRole(profile),
      status: profile.status ?? 'active',
      lastActiveAt: profile.lastActiveAt ?? null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
