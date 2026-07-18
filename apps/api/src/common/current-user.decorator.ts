import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { UserAccessProfile } from '@sfcc/shared';
import type { AuthenticatedRequest } from './auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.appUserId;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    return userId;
  },
);

/**
 * The authenticated user's access profile (role + granted modules + learning
 * features), attached by AuthGuard. Used to resolve per-feature gating.
 */
export const CurrentUserProfile = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserAccessProfile => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const profile = request.userProfile;
    if (!profile) throw new UnauthorizedException('Not authenticated');
    return profile;
  },
);
