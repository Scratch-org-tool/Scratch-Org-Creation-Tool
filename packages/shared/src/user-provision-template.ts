import { z } from 'zod';
import { bottlerIdSchema } from './bottler-sales-office-config.js';

export const userDiscoveryPolicySchema = z
  .enum(['strict', 'best_effort', 'disabled'])
  .default('best_effort');

export const usernamePolicySchema = z.object({
  strategy: z.literal('email_style').default('email_style'),
  domain: z.string().min(1).optional(),
  seed: z.literal('automation_run').default('automation_run'),
});

export const emailPolicySchema = z.object({
  strategy: z.enum(['provided', 'team_pool', 'generated']).default('provided'),
  domain: z.string().min(1).optional(),
  seed: z.literal('automation_run').default('automation_run'),
});

export const roleBottlerMappingSchema = z.object({
  role: z.string().min(1),
  bottler: z.string().min(1),
  salesforceRole: z.string().min(1).optional(),
  profile: z.string().min(1).optional(),
  permissionSets: z.array(z.string().min(1)).default([]),
  modules: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
});

export const teamEmailPoolSchema = z.object({
  emails: z.array(z.string().email()).min(1),
  allocation: z.literal('shuffled_round_robin').default('shuffled_round_robin'),
  allowReuse: z.boolean().default(false),
  seed: z.literal('automation_run').default('automation_run'),
});

export const userProvisionTeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  emailPool: teamEmailPoolSchema,
});

export const userProvisionTemplateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bottler: bottlerIdSchema,
  role: z.string().min(1),
  modules: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
});

export const userProvisionSlotSchema = z.object({
  templateId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional(),
  bottler: bottlerIdSchema.optional(),
  modules: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
});

export const concreteProvisionUserSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  username: z.string().min(1).optional(),
  role: z.string(),
  bottler: z.string(),
  modules: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  teamId: z.string().min(1).optional(),
});

export const userGeneratorSchema = z.object({
  id: z.string().min(1),
  count: z.number().int().positive(),
  role: z.string().min(1),
  bottler: z.string().min(1),
  teamId: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  firstNamePrefix: z.string().min(1).default('Generated'),
  lastNamePrefix: z.string().min(1).optional(),
  modules: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
});

export const userProvisionExecutionSchema = z.object({
  mode: z.literal('sequential').default('sequential'),
  concurrency: z.literal(1).default(1),
  failurePolicy: z.enum(['fail_fast', 'continue']).default('fail_fast'),
  discoveryFailurePolicy: z.enum(['fail', 'continue']).default('fail'),
});

export const userProvisioningConfigSchema = z.object({
  discoveryPolicy: userDiscoveryPolicySchema.optional(),
  usernamePolicy: usernamePolicySchema.optional(),
  emailPolicy: emailPolicySchema.optional(),
  roleBottlerMappings: z.array(roleBottlerMappingSchema).optional(),
  userGenerators: z.array(userGeneratorSchema).optional(),
  teams: z.array(userProvisionTeamSchema).optional(),
  execution: userProvisionExecutionSchema.optional(),
  users: z.array(concreteProvisionUserSchema).optional(),
  templates: z.array(userProvisionTemplateSchema).optional(),
  slots: z.array(userProvisionSlotSchema).optional(),
}).superRefine((config, context) => {
  const teamIds = new Set<string>();
  for (let index = 0; index < (config.teams?.length ?? 0); index += 1) {
    const team = config.teams![index];
    if (teamIds.has(team.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate team id: ${team.id}`,
        path: ['teams', index, 'id'],
      });
    }
    teamIds.add(team.id);
  }
  const generatorIds = new Set<string>();
  for (let index = 0; index < (config.userGenerators?.length ?? 0); index += 1) {
    const generator = config.userGenerators![index];
    if (generatorIds.has(generator.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate user generator id: ${generator.id}`,
        path: ['userGenerators', index, 'id'],
      });
    }
    generatorIds.add(generator.id);
    if (generator.teamId && !teamIds.has(generator.teamId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown team: ${generator.teamId}`,
        path: ['userGenerators', index, 'teamId'],
      });
    }
  }
});

export const userProvisionTemplatesFileSchema = z.object({
  bottler: bottlerIdSchema,
  templates: z.array(userProvisionTemplateSchema).min(1),
});

export type UserProvisionTemplate = z.infer<typeof userProvisionTemplateSchema>;
export type UserProvisionSlot = z.infer<typeof userProvisionSlotSchema>;
export type ConcreteProvisionUser = z.infer<typeof concreteProvisionUserSchema>;
export type UserGenerator = z.infer<typeof userGeneratorSchema>;
export type UserProvisionTeam = z.infer<typeof userProvisionTeamSchema>;
export type RoleBottlerMapping = z.infer<typeof roleBottlerMappingSchema>;
export type UserProvisioningConfig = z.infer<typeof userProvisioningConfigSchema>;

export interface ResolvedProvisionUser {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  bottler: string;
  modules: string[];
  locations: string[];
  username?: string;
  teamId?: string;
  generatorId?: string;
}

export function resolveUserProvisionSlots(
  slots: UserProvisionSlot[],
  templates: UserProvisionTemplate[],
): ResolvedProvisionUser[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  return slots.map((slot) => {
    const tmpl = byId.get(slot.templateId);
    if (!tmpl) {
      throw new Error(`Unknown user template: ${slot.templateId}`);
    }
    return {
      firstName: slot.firstName,
      lastName: slot.lastName,
      email: slot.email,
      role: slot.role ?? tmpl.role,
      bottler: slot.bottler ?? tmpl.bottler,
      modules: slot.modules ?? tmpl.modules,
      locations: slot.locations ?? tmpl.locations,
    };
  });
}

export function slotsToLegacyUsers(slots: UserProvisionSlot[], templates: UserProvisionTemplate[]) {
  return resolveUserProvisionSlots(slots, templates);
}

/** Produce a stable key for matching human-entered roles across templates and org discovery. */
export function normalizeRoleSlug(role: string): string {
  return role
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher-Yates shuffle which never mutates the caller's array. */
export function stableDeterministicShuffle<T>(values: readonly T[], seed: string): T[] {
  const shuffled = [...values];
  const random = seededRandom(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export const deterministicShuffle = stableDeterministicShuffle;

export interface EmailPoolAllocationOptions {
  seed: string;
  allowReuse?: boolean;
}

export function allocateEmailPool(
  emails: readonly string[],
  count: number,
  options: EmailPoolAllocationOptions,
): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Email allocation count must be a non-negative integer');
  }
  if (emails.length === 0 && count > 0) throw new Error('Email pool is empty');
  const normalized = emails.map((email) => email.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('Email pool contains duplicate addresses');
  }
  if (!options.allowReuse && count > normalized.length) {
    throw new Error(`Email pool has ${normalized.length} addresses but ${count} are required`);
  }
  const shuffled = stableDeterministicShuffle(normalized, options.seed);
  return Array.from({ length: count }, (_, index) => shuffled[index % shuffled.length]);
}

export const allocateEmailsRoundRobin = allocateEmailPool;

export interface EmailStyleUsernameInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  domain?: string;
  uniqueKey: string;
}

export function generateEmailStyleUsername(input: EmailStyleUsernameInput): string {
  const sourceEmail = input.email?.trim().toLowerCase();
  const emailMatch = sourceEmail?.match(/^([^@]+)@([^@]+)$/);
  const domain = (input.domain ?? emailMatch?.[2])?.trim().toLowerCase();
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new Error('A valid username domain or source email is required');
  }
  const nameLocal = [input.firstName, input.lastName]
    .filter(Boolean)
    .join('.')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/^[._-]+|[._-]+$/g, '');
  const local = emailMatch?.[1] || nameLocal || 'user';
  const unique = normalizeRoleSlug(input.uniqueKey) || hashSeed(input.uniqueKey).toString(36);
  return `${local}+${unique}@${domain}`;
}

export const generateUniqueUsername = generateEmailStyleUsername;

export function resolveRoleBottlerMapping(
  role: string,
  bottler: string,
  mappings: readonly RoleBottlerMapping[],
): RoleBottlerMapping | undefined {
  const roleSlug = normalizeRoleSlug(role);
  const matches = mappings.filter(
    (mapping) =>
      normalizeRoleSlug(mapping.role) === roleSlug
      && mapping.bottler.trim().toLowerCase() === bottler.trim().toLowerCase(),
  );
  if (matches.length > 1) {
    throw new Error(`Ambiguous role+bottler mapping for ${role}/${bottler}`);
  }
  return matches[0];
}

export interface ExpandUserGeneratorsOptions {
  automationRunId: string;
  teams?: readonly UserProvisionTeam[];
  roleBottlerMappings?: readonly RoleBottlerMapping[];
  usernamePolicy?: z.input<typeof usernamePolicySchema>;
  emailPolicy?: z.input<typeof emailPolicySchema>;
}

export function expandUserGenerators(
  generators: readonly UserGenerator[],
  options: ExpandUserGeneratorsOptions,
): ResolvedProvisionUser[] {
  const usernamePolicy = usernamePolicySchema.parse(options.usernamePolicy ?? {});
  const emailPolicy = emailPolicySchema.parse(options.emailPolicy ?? {});
  const teams = new Map((options.teams ?? []).map((team) => [team.id, team]));
  const result: ResolvedProvisionUser[] = [];
  const teamAllocations = new Map<string, string[]>();
  const teamAllocationOffsets = new Map<string, number>();

  for (const team of teams.values()) {
    const count = generators
      .filter((generator) => generator.teamId === team.id)
      .reduce((total, generator) => total + generator.count, 0);
    teamAllocations.set(
      team.id,
      allocateEmailPool(team.emailPool.emails, count, {
        seed: `${options.automationRunId}:${team.id}`,
        allowReuse: team.emailPool.allowReuse,
      }),
    );
    teamAllocationOffsets.set(team.id, 0);
  }

  for (const generator of generators) {
    const mapping = resolveRoleBottlerMapping(
      generator.role,
      generator.bottler,
      options.roleBottlerMappings ?? [],
    );
    const team = generator.teamId ? teams.get(generator.teamId) : undefined;
    if (generator.teamId && !team) throw new Error(`Unknown team: ${generator.teamId}`);
    let allocatedEmails: string[] = [];
    if (team) {
      const offset = teamAllocationOffsets.get(team.id) ?? 0;
      allocatedEmails = (teamAllocations.get(team.id) ?? []).slice(
        offset,
        offset + generator.count,
      );
      teamAllocationOffsets.set(team.id, offset + generator.count);
    } else if (emailPolicy.strategy !== 'generated') {
      throw new Error(`Generator ${generator.id} requires a team emailPool or generated email policy`);
    }

    for (let index = 0; index < generator.count; index += 1) {
      const ordinal = index + 1;
      const firstName = generator.firstName ?? `${generator.firstNamePrefix}${ordinal}`;
      const lastName =
        generator.lastName
        ?? `${generator.lastNamePrefix ?? (normalizeRoleSlug(generator.role) || 'User')}${ordinal}`;
      const uniqueKey = `${options.automationRunId}-${generator.id}-${ordinal}`;
      const email =
        allocatedEmails[index]
        ?? generateEmailStyleUsername({
          firstName,
          lastName,
          domain: emailPolicy.domain,
          uniqueKey,
        });
      const username = generateEmailStyleUsername({
        email,
        firstName,
        lastName,
        domain: usernamePolicy.domain,
        uniqueKey,
      });
      result.push({
        firstName,
        lastName,
        email,
        username,
        role: mapping?.salesforceRole ?? generator.role,
        bottler: generator.bottler,
        modules: generator.modules ?? mapping?.modules ?? [],
        locations: generator.locations ?? mapping?.locations ?? [],
        teamId: generator.teamId,
        generatorId: generator.id,
      });
    }
  }
  return result;
}
