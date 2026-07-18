import { z } from 'zod';
import {
  CONA_ADMIN_EXTENSION_PERMSET,
  CONA_BOTTLER_LABELS,
  CONA_SUPER_USER_PERMSET,
} from './constants.js';
import {
  allocateEmailPool,
  assertAndLimitEmailUsername,
  stableEntropy,
} from './user-provision-template.js';

/**
 * Lifecycle role-based user generation: expands "one user per Onboarding Role"
 * for a single bottler into the concrete users consumed by the existing
 * user-provision queue (CONA mode). Replaces the manual createLifecycleUsers
 * Apex script — see docs/lifecycle-user-provisioning-plan.md.
 */

export const LIFECYCLE_USERNAME_TOKENS = ['{role}', '{bottler}', '{bottlerLabel}', '{unique}'] as const;

export const DEFAULT_LIFECYCLE_USERNAME_PATTERN = '{role}.{bottlerLabel}.{unique}@lifecycle.scratch';

export const DEFAULT_LIFECYCLE_PROFILE = 'System Administrator';

export const lifecycleUserGenerationSchema = z.object({
  orgId: z.string().uuid(),
  bottler: z.string().trim().min(1),
  roles: z.array(z.string().trim().min(1)).min(1),
  modules: z.array(z.string().trim().min(1)).default([]),
  locations: z.array(z.string().trim().min(1)).default([]),
  emails: z.array(z.string().trim().email()).min(1),
  usernamePattern: z.string().trim().min(3).default(DEFAULT_LIFECYCLE_USERNAME_PATTERN),
  profile: z.string().trim().min(1).default(DEFAULT_LIFECYCLE_PROFILE),
}).superRefine((input, context) => {
  const emails = input.emails.map((email) => email.toLowerCase());
  if (new Set(emails).size !== emails.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Emails must be unique',
      path: ['emails'],
    });
  }
  const roles = input.roles.map((role) => role.toLowerCase());
  if (new Set(roles).size !== roles.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Roles must be unique',
      path: ['roles'],
    });
  }
  if (!input.usernamePattern.includes('@')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Username pattern must contain an @domain part',
      path: ['usernamePattern'],
    });
  }
});

export type LifecycleUserGenerationInput = z.infer<typeof lifecycleUserGenerationSchema>;

export interface LifecycleProvisionUser {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
  bottler: string;
  modules: string[];
  locations: string[];
  profile: string;
  permissionSets: string[];
}

/** Apex parity: everyone gets the admin extension; Master Data also gets super user. */
export function lifecyclePermissionSets(role: string): string[] {
  return role.trim().toLowerCase() === 'master data'
    ? [CONA_ADMIN_EXTENSION_PERMSET, CONA_SUPER_USER_PERMSET]
    : [CONA_ADMIN_EXTENSION_PERMSET];
}

export function resolveBottlerLabel(bottler: string): string {
  return (CONA_BOTTLER_LABELS as Record<string, string>)[bottler.trim()] ?? bottler.trim();
}

/** Lowercased alphanumeric form used inside usernames (e.g. "Master Data" -> "masterdata"). */
function compactToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export interface LifecycleUsernameValues {
  role: string;
  bottler: string;
  bottlerLabel: string;
  /** Batch seed; keeps `{unique}` stable so worker retries reconcile by username. */
  seed: string;
  ordinal: number;
}

export function formatLifecycleUsername(pattern: string, values: LifecycleUsernameValues): string {
  const unique = stableEntropy(`${values.seed}:${values.role}:${values.ordinal}`).slice(0, 8);
  const formatted = pattern
    .replace(/\{bottlerlabel\}/gi, compactToken(values.bottlerLabel) || compactToken(values.bottler) || 'bottler')
    .replace(/\{bottler\}/gi, compactToken(values.bottler) || 'bottler')
    .replace(/\{role\}/gi, compactToken(values.role) || 'user')
    .replace(/\{unique\}/gi, unique);
  const unknownToken = formatted.match(/\{[^}]*\}/);
  if (unknownToken) {
    throw new Error(
      `Unknown username token ${unknownToken[0]} — supported tokens: ${LIFECYCLE_USERNAME_TOKENS.join(', ')}`,
    );
  }
  return assertAndLimitEmailUsername(formatted.toLowerCase());
}

export interface LifecycleExpansionInput extends LifecycleUserGenerationInput {
  /** Deterministic seed for email allocation and `{unique}` (the provisioning batch). */
  seed: string;
  bottlerLabel: string;
}

/**
 * One user per selected role. Emails are distributed over the roles with the
 * shared deterministic shuffled round-robin (1 email -> everyone gets it,
 * 2+ emails -> alternated across roles in shuffled order).
 */
export function expandLifecycleUsers(input: LifecycleExpansionInput): LifecycleProvisionUser[] {
  const emails = allocateEmailPool(input.emails, input.roles.length, {
    seed: input.seed,
    allowReuse: true,
  });
  const users = input.roles.map((role, index) => ({
    // Apex parity: FirstName = role without spaces, LastName = bottler label.
    firstName: role.replace(/[^A-Za-z0-9]+/g, '') || 'User',
    lastName: input.bottlerLabel,
    email: emails[index],
    username: formatLifecycleUsername(input.usernamePattern, {
      role,
      bottler: input.bottler,
      bottlerLabel: input.bottlerLabel,
      seed: input.seed,
      ordinal: index + 1,
    }),
    role,
    bottler: input.bottler,
    modules: [...input.modules],
    locations: [...input.locations],
    profile: input.profile,
    permissionSets: lifecyclePermissionSets(role),
  }));
  const usernames = new Set<string>();
  for (const user of users) {
    const username = user.username.toLowerCase();
    if (usernames.has(username)) {
      throw new Error(
        `Username pattern produced the duplicate username "${user.username}" — include {role} or {unique} so each role gets a distinct username`,
      );
    }
    usernames.add(username);
  }
  return users;
}
