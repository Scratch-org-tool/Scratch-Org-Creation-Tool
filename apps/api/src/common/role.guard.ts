import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@sfcc/shared';
import type { AuthenticatedRequest } from './auth.guard';

export const ROLE_KEY = 'required_role';

/** Restrict a route to a specific role (must be used together with AuthGuard). */
export const RequireRole = (role: UserRole) => SetMetadata(ROLE_KEY, role);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const role = this.reflector.getAllAndOverride<UserRole>(ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!role) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.userProfile?.role !== role) {
      throw new ForbiddenException('This action requires administrator access');
    }
    return true;
  }
}
