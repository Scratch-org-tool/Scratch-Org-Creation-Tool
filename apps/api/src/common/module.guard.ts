import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { canAccessModule, type AppModule } from '@sfcc/shared';
import type { AuthenticatedRequest } from './auth.guard';

export const MODULE_KEY = 'required_module';

export const RequireModule = (module: AppModule) => SetMetadata(MODULE_KEY, module);

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const module = this.reflector.getAllAndOverride<AppModule>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!module) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const profile = request.userProfile;
    if (!profile || !canAccessModule(profile, module)) {
      throw new ForbiddenException(`Access to module '${module}' is not granted`);
    }
    return true;
  }
}
