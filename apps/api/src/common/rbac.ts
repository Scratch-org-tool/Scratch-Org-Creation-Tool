import { PERSONAS } from '@sfcc/shared';

export type Persona = (typeof PERSONAS)[keyof typeof PERSONAS];

const PERSONA_PERMISSIONS: Record<Persona, string[]> = {
  developer: [
    'environment:*',
    'data:*',
    'copilot:*',
    'jobs:read',
    'orgs:*',
  ],
  release_manager: [
    'deployment:*',
    'copilot:*',
    'jobs:read',
    'monitoring:read',
    'orgs:read',
  ],
  qa: [
    'environment:read',
    'data:*',
    'copilot:*',
    'jobs:read',
    'orgs:read',
  ],
  admin: [
    'org-setup:*',
    'provisioning:*',
    'copilot:*',
    'orgs:*',
    'jobs:read',
    'monitoring:read',
  ],
};

export function canAccess(persona: Persona, permission: string): boolean {
  const perms = PERSONA_PERMISSIONS[persona] ?? [];
  return perms.some((p) => {
    if (p === permission) return true;
    const [resource, action] = p.split(':');
    const [reqResource, reqAction] = permission.split(':');
    return resource === reqResource && (action === '*' || action === reqAction);
  });
}

export function getPersonaPermissions(persona: Persona): string[] {
  return PERSONA_PERMISSIONS[persona] ?? [];
}
