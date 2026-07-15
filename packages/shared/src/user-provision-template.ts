import { z } from 'zod';
import { bottlerIdSchema } from './bottler-sales-office-config.js';

export const userDiscoveryPolicySchema = z
  .enum(['strict', 'best_effort', 'disabled'])
  .default('best_effort');

export const usernamePolicySchema = z.object({
  strategy: z.literal('email_style').default('email_style'),
  domain: z.string().min(1).optional(),
  pattern: z.string().min(1).optional(),
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
  profile: z.string().min(1).optional(),
  permissionSets: z.array(z.string().min(1)).optional(),
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
  profile: z.string().min(1).optional(),
  permissionSets: z.array(z.string().min(1)).optional(),
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
  profile: z.string().min(1).optional(),
  permissionSets: z.array(z.string().min(1)).optional(),
});

export const userProvisionExecutionSchema = z.object({
  mode: z.literal('sequential').default('sequential'),
  concurrency: z.literal(1).default(1),
  failurePolicy: z.enum(['fail_fast', 'continue']).default('fail_fast'),
  discoveryFailurePolicy: z.enum(['fail', 'continue']).default('fail'),
});

export const userProvisioningConfigSchema = z.object({
  discoveryPolicy: userDiscoveryPolicySchema.optional(),
  defaultProfile: z.string().min(1).optional(),
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
  profile?: string;
  permissionSets?: string[];
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
      ...(slot.profile ? { profile: slot.profile } : {}),
      ...(slot.permissionSets ? { permissionSets: slot.permissionSets } : {}),
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

function stableEntropy(seed: string): string {
  return `${hashSeed(seed).toString(36)}${hashSeed(`sfcc:${seed}`).toString(36)}`.slice(0, 13);
}

function assertAndLimitEmailUsername(username: string): string {
  const match = username.trim().match(/^([^@\s]+)@([^@\s]+)$/);
  if (!match || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(match[2])) {
    throw new Error('Username must be in email format');
  }
  const maxLocalLength = 80 - match[2].length - 1;
  if (maxLocalLength < 1) throw new Error('Username domain is too long');
  const local = match[1].slice(0, maxLocalLength).replace(/[.+_-]+$/g, '') || 'u';
  const result = `${local}@${match[2]}`;
  if (result.length > 80) throw new Error('Username must be at most 80 characters');
  return result;
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
  const candidate = `${local}+${unique}@${domain}`;
  if (candidate.length <= 80) return assertAndLimitEmailUsername(candidate);
  const entropy = stableEntropy(input.uniqueKey);
  const maxLocal = 80 - domain.length - entropy.length - 2;
  return assertAndLimitEmailUsername(
    `${local.slice(0, Math.max(1, maxLocal))}+${entropy}@${domain}`,
  );
}

export const generateUniqueUsername = generateEmailStyleUsername;

export function formatProvisioningUsername(
  username: string,
  pattern: string | undefined,
  values: { runId: string; generatorId?: string; ordinal: number; userKey?: string },
): string {
  if (!pattern) return assertAndLimitEmailUsername(username);
  const entropy = stableEntropy(
    `${values.runId}:${values.userKey ?? values.generatorId ?? 'user'}:${values.ordinal}`,
  );
  let formatted = pattern
    .replace(/\{\{local\}\}/g, username.split('@')[0])
    .replace(/\{\{domain\}\}/g, username.split('@')[1])
    .replace(/\{\{runId\}\}/g, normalizeRoleSlug(values.runId))
    .replace(/\{\{generatorId\}\}/g, normalizeRoleSlug(values.generatorId ?? 'user'))
    .replace(/\{\{ordinal\}\}/g, String(values.ordinal))
    .replace(/\{\{entropy\}\}/g, entropy);
  if (!pattern.includes('{{local}}') && !pattern.includes('{{entropy}}')) {
    const at = formatted.lastIndexOf('@');
    if (at <= 0) throw new Error('Username pattern produced an invalid username');
    formatted = `${formatted.slice(0, at)}+${entropy}${formatted.slice(at)}`;
  }
  if (formatted.length > 80) {
    const at = formatted.lastIndexOf('@');
    if (at <= 0) throw new Error('Username pattern produced an invalid username');
    const domain = formatted.slice(at + 1);
    const maxPrefix = 80 - domain.length - entropy.length - 2;
    if (maxPrefix < 1) throw new Error('Username pattern domain is too long');
    formatted = `${formatted.slice(0, maxPrefix)}+${entropy}@${domain}`;
  }
  return assertAndLimitEmailUsername(formatted);
}

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
  defaultProfile?: string;
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
      const patternedUsername = formatProvisioningUsername(username, usernamePolicy.pattern, {
        runId: options.automationRunId,
        generatorId: generator.id,
        ordinal,
        userKey: uniqueKey,
      });
      result.push({
        firstName,
        lastName,
        email,
        username: patternedUsername,
        role: mapping?.salesforceRole ?? generator.role,
        bottler: generator.bottler,
        modules: generator.modules ?? mapping?.modules ?? [],
        locations: generator.locations ?? mapping?.locations ?? [],
        teamId: generator.teamId,
        generatorId: generator.id,
        profile: generator.profile ?? mapping?.profile ?? options.defaultProfile,
        permissionSets: generator.permissionSets ?? mapping?.permissionSets ?? [],
      });
    }
  }
  return result;
}

/**
 * Resolve every supported user source once into the immutable plan used by
 * previews, database rows, and queue payloads.
 */
export function resolveUserProvisioningPlan(
  input: z.input<typeof userProvisioningConfigSchema> | UserProvisioningConfig,
  automationRunId: string,
): ResolvedProvisionUser[] {
  const config = userProvisioningConfigSchema.parse(input);
  const slotted = config.slots?.length
    ? resolveUserProvisionSlots(config.slots, config.templates ?? [])
    : [];
  const generated = config.userGenerators?.length
    ? expandUserGenerators(config.userGenerators, {
        automationRunId,
        teams: config.teams,
        roleBottlerMappings: config.roleBottlerMappings,
        usernamePolicy: config.usernamePolicy,
        emailPolicy: config.emailPolicy,
        defaultProfile: config.defaultProfile,
      })
    : [];
  const candidates = [...(config.users ?? []), ...slotted, ...generated];
  const exactUsers = new Set<string>();
  const resolved = candidates.filter((user) => {
    const key = JSON.stringify([
      user.firstName,
      user.lastName,
      user.email.trim().toLowerCase(),
      user.username?.trim().toLowerCase(),
    ]);
    if (exactUsers.has(key)) return false;
    exactUsers.add(key);
    return true;
  }).map((user, index) => {
    const mapping = resolveRoleBottlerMapping(
      user.role,
      user.bottler,
      config.roleBottlerMappings ?? [],
    );
    const ordinal = index + 1;
    const userKey = `${automationRunId}:${user.email.trim().toLowerCase()}:${ordinal}`;
    const username = user.username
      ? assertAndLimitEmailUsername(user.username)
      : formatProvisioningUsername(
          generateEmailStyleUsername({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            domain: config.usernamePolicy?.domain,
            uniqueKey: userKey,
          }),
          config.usernamePolicy?.pattern,
          {
            runId: automationRunId,
            generatorId: (user as ResolvedProvisionUser).generatorId,
            ordinal,
            userKey,
          },
        );
    return {
      ...user,
      username,
      role: mapping?.salesforceRole ?? user.role,
      profile: user.profile ?? mapping?.profile ?? config.defaultProfile,
      permissionSets: user.permissionSets ?? mapping?.permissionSets ?? [],
      modules: user.modules ?? mapping?.modules ?? [],
      locations: user.locations ?? mapping?.locations ?? [],
    };
  });
  const usernames = new Set<string>();
  for (const user of resolved) {
    const username = user.username!.toLowerCase();
    if (usernames.has(username)) {
      throw new Error(`Resolved provisioning usernames are not unique: ${user.username}`);
    }
    usernames.add(username);
  }
  return resolved;
}

export function unresolvedV2Profiles(config: UserProvisioningConfig): string[] {
  const missing: string[] = [];
  const mappings = config.roleBottlerMappings ?? [];
  const check = (label: string, role: string, bottler: string, profile?: string) => {
    const mapping = resolveRoleBottlerMapping(role, bottler, mappings);
    if (!(profile ?? mapping?.profile ?? config.defaultProfile)) missing.push(label);
  };
  for (const user of config.users ?? []) {
    check(user.email, user.role, user.bottler, user.profile);
  }
  for (const generator of config.userGenerators ?? []) {
    check(`generator:${generator.id}`, generator.role, generator.bottler, generator.profile);
  }
  const templates = new Map((config.templates ?? []).map((template) => [template.id, template]));
  for (const slot of config.slots ?? []) {
    const template = templates.get(slot.templateId);
    if (template) {
      check(
        slot.email,
        slot.role ?? template.role,
        slot.bottler ?? template.bottler,
        slot.profile,
      );
    }
  }
  return missing;
}
