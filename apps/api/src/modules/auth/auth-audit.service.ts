import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { AuthSecurityService } from './auth-security.service';

export const AUTH_AUDIT_EVENTS = {
  PROFILE_UPDATE_FAILED: 'profile_update_failed',
  PROFILE_UPDATE_SUCCESS: 'profile_update_success',
  PASSWORD_CHANGE_FAILED: 'password_change_failed',
  PASSWORD_CHANGE_SUCCESS: 'password_change_success',
  SESSIONS_REVOKED: 'sessions_revoked',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
} as const;

export interface AuthAuditContext {
  ip: string;
  userAgent?: string;
}

type SafeMetadataValue = string | number | boolean | null;

@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  constructor(private readonly security: AuthSecurityService) {}

  async record(
    userId: string | null,
    eventType: (typeof AUTH_AUDIT_EVENTS)[keyof typeof AUTH_AUDIT_EVENTS],
    context: AuthAuditContext,
    metadata?: Record<string, SafeMetadataValue>,
  ): Promise<void> {
    try {
      await prisma.authAuditEvent.create({
        data: {
          userId,
          eventType,
          metadata: metadata ? this.safeMetadata(metadata) : undefined,
          ipHash: this.security.hashIp(context.ip),
          userAgentHash: context.userAgent
            ? this.security.hashUserAgent(context.userAgent)
            : undefined,
        },
      });
    } catch {
      // Account operations may already have completed and cannot always be
      // rolled back. Emit only a fixed event label, never request contents.
      this.logger.error(`auth_audit_write_failed event=${eventType}`);
    }
  }

  private safeMetadata(
    metadata: Record<string, SafeMetadataValue>,
  ): Record<string, SafeMetadataValue> {
    const safe: Record<string, SafeMetadataValue> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (/password|token|secret|raw|email|ip|useragent/i.test(key)) continue;
      safe[key] = typeof value === 'string' ? value.slice(0, 120) : value;
    }
    return safe;
  }
}
