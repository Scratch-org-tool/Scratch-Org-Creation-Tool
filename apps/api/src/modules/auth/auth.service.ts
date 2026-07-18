import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createCustomTokenForUid,
  revokeFirebaseRefreshTokens,
  updateFirebaseAuthDisplayName,
  updateFirebaseAuthPassword,
} from '@sfcc/firebase';
import {
  AUTH_ACCESS_LAST_ADMIN,
  AUTH_ACCESS_SELF_FORBIDDEN,
  AUTH_ACCOUNT_ACTION_FAILED,
  AUTH_GENERIC_INVALID,
  AUTH_LOGIN_FAILED,
  AUTH_PASSWORD_CHANGED,
  AUTH_RATE_LIMITED_CODE,
  AUTH_RESET_SENT,
  AUTH_SESSIONS_REVOKED,
  AUTH_SIGNUP_FAILED,
  AUTH_EMAIL_EXISTS,
  AUTH_UNAVAILABLE,
  AUTH_USER_NOT_FOUND,
  type ForgotPasswordInput,
  type LoginInput,
  type MeResponse,
  type RegisterBodyInput,
  type SignupInput,
  type ChangePasswordInput,
  type UpdateMeInput,
  getEffectiveModules,
  displayAccessRole,
  toAppUserId,
  type AppModule,
  type UserAccessStatus,
  type UserRole,
} from '@sfcc/shared';
import {
  countActiveAdminUsers,
  getAppUser,
  getAppUserByFirebaseUid,
  listAppUsers,
  touchLastActive,
  updateAppUser,
  upsertAppUser,
} from './app-user.service';
import { computeUserAccessStats } from './user-access-stats.util';
import { FirebaseIdentityError, FirebaseIdentityService } from './firebase-identity.service';
import { AuthSecurityService } from './auth-security.service';
import {
  AUTH_AUDIT_EVENTS,
  AuthAuditService,
  type AuthAuditContext,
} from './auth-audit.service';

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
    private readonly authAudit: AuthAuditService,
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
      throw this.tooManyRequests(AUTH_LOGIN_FAILED);
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
      throw this.tooManyRequests(AUTH_SIGNUP_FAILED);
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

  async sendPasswordReset(
    input: ForgotPasswordInput,
    clientIp: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    if (!(await this.authSecurity.checkIpRateLimit(clientIp, 'forgot'))) {
      await this.authAudit.record(
        null,
        AUTH_AUDIT_EVENTS.PASSWORD_RESET_REQUESTED,
        { ip: clientIp, userAgent },
        { accepted: true, rateLimited: true },
      );
      return { message: AUTH_RESET_SENT };
    }
    try {
      await this.firebaseIdentity.sendPasswordResetEmail(input.email);
    } catch {
      this.logger.warn(`auth_reset_request emailHash=${this.authSecurity.hashEmail(input.email).slice(0, 12)}`);
    }
    await this.authAudit.record(
      null,
      AUTH_AUDIT_EVENTS.PASSWORD_RESET_REQUESTED,
      { ip: clientIp, userAgent },
      { accepted: true },
    );
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
          throw this.tooManyRequests(AUTH_GENERIC_INVALID);
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
          throw this.tooManyRequests(AUTH_GENERIC_INVALID);
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

  async updateMe(
    firebaseUid: string,
    appUserId: string,
    input: UpdateMeInput,
    context: AuthAuditContext,
  ) {
    try {
      return await this.authSecurity.withAccountMutationLock(
        firebaseUid,
        async () => {
          const profile = await this.assertActiveAccount(
            firebaseUid,
            appUserId,
            context,
            AUTH_AUDIT_EVENTS.PROFILE_UPDATE_FAILED,
          );

          try {
            await updateFirebaseAuthDisplayName(firebaseUid, input.displayName);
          } catch {
            await this.recordAuditBestEffort(
              profile.id,
              AUTH_AUDIT_EVENTS.PROFILE_UPDATE_FAILED,
              context,
              { stage: 'firebase_update', compensated: false },
            );
            throw new BadRequestException(AUTH_ACCOUNT_ACTION_FAILED);
          }

          let updated;
          try {
            updated = await updateAppUser(profile.id, {
              displayName: input.displayName,
            });
          } catch {
            let compensated = false;
            try {
              // Re-read the authoritative profile before compensation. This
              // prevents a failed older request from overwriting a newer
              // successful request if distributed locking is degraded.
              const authoritative = await getAppUserByFirebaseUid(firebaseUid);
              await updateFirebaseAuthDisplayName(
                firebaseUid,
                authoritative?.displayName ?? profile.displayName,
              );
              compensated = true;
            } catch {
              // The audit marker allows an operator to reconcile Firebase from
              // the authoritative AppUser profile.
            }
            await this.recordAuditBestEffort(
              profile.id,
              AUTH_AUDIT_EVENTS.PROFILE_UPDATE_FAILED,
              context,
              {
                stage: 'database_update',
                compensated,
                reconciliationRequired: !compensated,
              },
            );
            throw new BadRequestException(AUTH_ACCOUNT_ACTION_FAILED);
          }

          await this.recordAuditBestEffort(
            profile.id,
            AUTH_AUDIT_EVENTS.PROFILE_UPDATE_SUCCESS,
            context,
          );
          return this.toMeResponse(updated);
        },
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.warn('auth_profile_update_lock_failed');
      throw new ServiceUnavailableException(AUTH_ACCOUNT_ACTION_FAILED);
    }
  }

  async changePassword(
    firebaseUid: string,
    appUserId: string,
    tokenEmail: string,
    input: ChangePasswordInput,
    context: AuthAuditContext,
  ): Promise<{
    message: string;
    reauthenticationRequired: true;
  }> {
    const profile = await this.assertActiveAccount(
      firebaseUid,
      appUserId,
      context,
      AUTH_AUDIT_EVENTS.PASSWORD_CHANGE_FAILED,
    );
    await this.applyAccountActionGuards(profile.id, context, 'change-password');

    try {
      await this.firebaseIdentity.verifyCurrentPassword(
        tokenEmail,
        input.currentPassword,
        firebaseUid,
      );
    } catch {
      await this.recordAccountActionFailure(
        profile.id,
        context,
        'change-password',
        'current_credentials',
      );
      throw new BadRequestException(AUTH_ACCOUNT_ACTION_FAILED);
    }

    try {
      await updateFirebaseAuthPassword(firebaseUid, input.newPassword);
    } catch {
      await this.recordAccountActionFailure(
        profile.id,
        context,
        'change-password',
        'password_update',
      );
      throw new BadRequestException(AUTH_ACCOUNT_ACTION_FAILED);
    }

    try {
      await revokeFirebaseRefreshTokens(firebaseUid);
    } catch {
      this.logger.error('auth_password_change_revoke_failed');
      await this.recordAuditBestEffort(
        profile.id,
        AUTH_AUDIT_EVENTS.PASSWORD_CHANGE_SUCCESS,
        context,
        {
          sessionsRevoked: false,
          reconciliationRequired: true,
        },
      );
      throw new ServiceUnavailableException({
        message: AUTH_ACCOUNT_ACTION_FAILED,
        reauthenticationRequired: true,
      });
    }

    try {
      await Promise.all([
        this.authSecurity.clearLoginFailures(this.authSecurity.hashEmail(tokenEmail)),
        this.authSecurity.clearAccountActionFailures(
          profile.id,
          context.ip,
          'change-password',
        ),
      ]);
    } catch {
      this.logger.warn('auth_password_change_counter_clear_failed');
    }

    await this.recordAuditBestEffort(
      profile.id,
      AUTH_AUDIT_EVENTS.SESSIONS_REVOKED,
      context,
      { source: 'password_change' },
    );
    await this.recordAuditBestEffort(
      profile.id,
      AUTH_AUDIT_EVENTS.PASSWORD_CHANGE_SUCCESS,
      context,
      {
        sessionsRevoked: true,
        reconciliationRequired: false,
      },
    );
    return {
      message: AUTH_PASSWORD_CHANGED,
      reauthenticationRequired: true,
    };
  }

  async logoutAll(
    firebaseUid: string,
    appUserId: string,
    context: AuthAuditContext,
  ): Promise<{ message: string; reauthenticationRequired: true }> {
    const profile = await this.assertActiveAccount(firebaseUid, appUserId);
    await this.applyAccountActionGuards(profile.id, context, 'logout-all');

    try {
      await revokeFirebaseRefreshTokens(firebaseUid);
    } catch {
      await this.authSecurity.recordAccountActionFailure(
        profile.id,
        context.ip,
        'logout-all',
      );
      throw new BadRequestException(AUTH_ACCOUNT_ACTION_FAILED);
    }

    try {
      await this.authSecurity.clearAccountActionFailures(
        profile.id,
        context.ip,
        'logout-all',
      );
    } catch {
      this.logger.warn('auth_logout_all_counter_clear_failed');
    }

    await this.recordAuditBestEffort(
      profile.id,
      AUTH_AUDIT_EVENTS.SESSIONS_REVOKED,
      context,
      { source: 'logout_all' },
    );
    return {
      message: AUTH_SESSIONS_REVOKED,
      reauthenticationRequired: true,
    };
  }

  async auditRejectedAccountRequest(
    action: 'profile-update' | 'change-password',
    appUserId: string,
    context: AuthAuditContext,
  ): Promise<void> {
    await this.authAudit.record(
      appUserId,
      action === 'profile-update'
        ? AUTH_AUDIT_EVENTS.PROFILE_UPDATE_FAILED
        : AUTH_AUDIT_EVENTS.PASSWORD_CHANGE_FAILED,
      context,
      { reason: 'validation' },
    );
  }

  async listUsers(requesterFirebaseUid: string) {
    await this.assertAdmin(requesterFirebaseUid);
    const users = await listAppUsers(true);
    return users.map((u) => this.toMeResponse(u));
  }

  async getUsersOverview(requesterFirebaseUid: string) {
    await this.assertAdmin(requesterFirebaseUid);
    // Single query — stats are derived from the same list the table renders.
    const users = await listAppUsers(true);
    return {
      stats: computeUserAccessStats(users),
      users: users.map((u) => this.toAccessRow(u)),
    };
  }

  async listAuditEvents(
    requesterFirebaseUid: string,
    options: { limit: number; offset: number },
  ) {
    await this.assertAdmin(requesterFirebaseUid);
    return this.authAudit.listEvents(options);
  }

  async updateUserAccess(
    requesterFirebaseUid: string,
    targetUserId: string,
    body: {
      grantedModules?: AppModule[];
      revokedModules?: AppModule[];
      learningAssignedOnly?: boolean;
      role?: UserRole;
      status?: UserAccessStatus;
    },
    context: AuthAuditContext,
  ) {
    const requester = await this.assertAdmin(requesterFirebaseUid);

    const target = await getAppUser(targetUserId);
    if (!target) {
      throw new NotFoundException(AUTH_USER_NOT_FOUND);
    }

    // Admins cannot change their own role/status/modules from this console.
    // This prevents accidental self-lockout and privilege self-management;
    // self-service goes through the account settings flow instead.
    if (target.id === requester.id) {
      await this.recordAuditBestEffort(
        requester.id,
        AUTH_AUDIT_EVENTS.USER_ACCESS_UPDATE_DENIED,
        context,
        { reason: 'self', targetId: target.id },
      );
      throw new ForbiddenException(AUTH_ACCESS_SELF_FORBIDDEN);
    }

    // Last-admin protection: never demote or deactivate the final active admin.
    const removesAdminPrivilege =
      target.role === 'admin' &&
      target.status !== 'inactive' &&
      ((body.role != null && body.role !== 'admin') || body.status === 'inactive');
    if (removesAdminPrivilege && (await countActiveAdminUsers()) <= 1) {
      await this.recordAuditBestEffort(
        requester.id,
        AUTH_AUDIT_EVENTS.USER_ACCESS_UPDATE_DENIED,
        context,
        { reason: 'last_admin', targetId: target.id },
      );
      throw new ForbiddenException(AUTH_ACCESS_LAST_ADMIN);
    }

    let updated;
    try {
      updated = await updateAppUser(targetUserId, body);
    } catch {
      throw new BadRequestException(AUTH_GENERIC_INVALID);
    }

    await this.recordAuditBestEffort(
      target.id,
      AUTH_AUDIT_EVENTS.USER_ACCESS_UPDATED,
      context,
      {
        actorId: requester.id,
        roleChanged: body.role != null && body.role !== target.role,
        statusChanged:
          body.status != null && body.status !== (target.status ?? 'active'),
        modulesChanged: body.grantedModules != null || body.revokedModules != null,
        learningScopeChanged:
          body.learningAssignedOnly != null &&
          body.learningAssignedOnly !== (target.learningAssignedOnly ?? false),
        nextRole: updated.role,
        nextStatus: updated.status ?? 'active',
        moduleCount: updated.grantedModules.length,
        revokedCount: updated.revokedModules?.length ?? 0,
        learningAssignedOnly: updated.learningAssignedOnly ?? false,
      },
    );

    return this.toAccessRow(updated);
  }

  private async assertAdmin(firebaseUid: string) {
    const profile = await getAppUserByFirebaseUid(firebaseUid);
    if (!profile || profile.role !== 'admin') {
      throw new ForbiddenException(AUTH_GENERIC_INVALID);
    }
    return profile;
  }

  private async assertActiveAccount(
    firebaseUid: string,
    appUserId: string,
    context?: AuthAuditContext,
    failedEvent?:
      | typeof AUTH_AUDIT_EVENTS.PROFILE_UPDATE_FAILED
      | typeof AUTH_AUDIT_EVENTS.PASSWORD_CHANGE_FAILED,
  ) {
    const profile = await getAppUserByFirebaseUid(firebaseUid);
    const isAuthenticatedIdentity =
      profile?.id === appUserId || profile?.id === firebaseUid;
    if (!profile || !isAuthenticatedIdentity || profile.status !== 'active') {
      if (context && failedEvent) {
        await this.authAudit.record(
          profile?.id ?? appUserId,
          failedEvent,
          context,
          { reason: 'inactive_or_unavailable' },
        );
      }
      throw new ForbiddenException(AUTH_ACCOUNT_ACTION_FAILED);
    }
    return profile;
  }

  private async applyAccountActionGuards(
    userId: string,
    context: AuthAuditContext,
    action: 'change-password' | 'logout-all',
  ): Promise<void> {
    const delayMs = await this.authSecurity.getAccountActionDelayMs(
      userId,
      context.ip,
      action,
    );
    await this.authSecurity.sleep(delayMs);
    if (!(await this.authSecurity.checkAccountRateLimit(userId, context.ip, action))) {
      await this.authSecurity.recordAccountActionFailure(userId, context.ip, action);
      if (action === 'change-password') {
        await this.recordAuditBestEffort(
          userId,
          AUTH_AUDIT_EVENTS.PASSWORD_CHANGE_FAILED,
          context,
          { reason: 'rate_limit' },
        );
      }
      throw this.tooManyRequests(AUTH_ACCOUNT_ACTION_FAILED);
    }
  }

  private async recordAccountActionFailure(
    userId: string,
    context: AuthAuditContext,
    action: 'change-password',
    reason: string,
  ): Promise<void> {
    await this.authSecurity.recordAccountActionFailure(userId, context.ip, action);
    await this.authAudit.record(
      userId,
      AUTH_AUDIT_EVENTS.PASSWORD_CHANGE_FAILED,
      context,
      { reason },
    );
  }

  private tooManyRequests(message: string): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: AUTH_RATE_LIMITED_CODE,
        message,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async recordAuditBestEffort(
    userId: string | null,
    eventType: (typeof AUTH_AUDIT_EVENTS)[keyof typeof AUTH_AUDIT_EVENTS],
    context: AuthAuditContext,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    try {
      await this.authAudit.record(userId, eventType, context, metadata);
    } catch {
      this.logger.warn(`auth_audit_callback_failed event=${eventType}`);
    }
  }

  private toMeResponse(profile: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    grantedModules: AppModule[];
    revokedModules?: AppModule[];
    learningAssignedOnly?: boolean;
    status?: UserAccessStatus;
    lastActiveAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }): MeResponse {
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
    revokedModules?: AppModule[];
    learningAssignedOnly?: boolean;
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
