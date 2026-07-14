import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyIdToken } from '@sfcc/firebase';
import { toAppUserId, AUTH_GENERIC_INVALID, type UserAccessProfile } from '@sfcc/shared';
import { AuthService } from '../modules/auth/auth.service';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  user?: { uid: string; appUserId: string; email: string };
  userProfile?: UserAccessProfile;
}

export const ALLOW_UNREGISTERED_KEY = 'allow_unregistered';

/** Allow Firebase-authenticated users who have not yet registered for Deployment Tool. */
export const AllowUnregistered = () => SetMetadata(ALLOW_UNREGISTERED_KEY, true);

export function extractBearerToken(request: AuthenticatedRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader || Array.isArray(authHeader)) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function extractTokenFromQuery(request: AuthenticatedRequest): string | null {
  const token = request.query.token;
  if (!token || Array.isArray(token)) return null;
  return token;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request) ?? extractTokenFromQuery(request);
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const allowUnregistered = this.reflector.getAllAndOverride<boolean>(ALLOW_UNREGISTERED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    try {
      const decoded = await verifyIdToken(token);
      const uid = decoded.uid;
      const email = decoded.email ?? '';
      const appUserId = toAppUserId(uid);
      request.user = { uid, appUserId, email };

      const profile = await this.authService.getProfileByFirebaseUid(uid);
      if (!profile && !allowUnregistered) {
        throw new ForbiddenException(AUTH_GENERIC_INVALID);
      }
      if (profile && profile.status === 'inactive') {
        throw new ForbiddenException('Account is inactive — contact an administrator');
      }
      request.userProfile = profile ?? undefined;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (process.env.NODE_ENV !== 'production') {
        console.error('[AuthGuard] Token verification failed:', error instanceof Error ? error.message : error);
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
