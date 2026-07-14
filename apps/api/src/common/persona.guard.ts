import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { canAccess, type Persona } from './rbac';

export const PERSONA_HEADER = 'x-persona';

@Injectable()
export class PersonaGuard implements CanActivate {
  constructor(private readonly permission: string) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const persona = (request.headers[PERSONA_HEADER] ?? 'developer') as Persona;
    if (!canAccess(persona, this.permission)) {
      throw new ForbiddenException(`Persona '${persona}' cannot access ${this.permission}`);
    }
    return true;
  }
}

export function RequirePermission(permission: string) {
  return PersonaGuard.bind(null, permission);
}
