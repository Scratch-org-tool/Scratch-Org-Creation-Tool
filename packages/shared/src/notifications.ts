import { z } from 'zod';
import { QUEUE_NAMES } from './constants.js';

/**
 * Notification categories map coarse product areas to a single admin toggle.
 * Every emitted notification is tagged with exactly one category so the admin
 * console can enable/disable whole streams of alerts at once.
 */
export const NOTIFICATION_CATEGORIES = [
  'deployment',
  'data',
  'environment',
  'provisioning',
  'defects',
  'system',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  deployment: 'Deployments',
  data: 'Data movements',
  environment: 'Environments & scratch orgs',
  provisioning: 'User provisioning',
  defects: 'Developer Board work items',
  system: 'System & account',
};

export const NOTIFICATION_CATEGORY_DESCRIPTIONS: Record<NotificationCategory, string> = {
  deployment: 'Metadata deploy, validation, and Deployment Workbench run outcomes.',
  data: 'Org-to-org data loads, SFDMU runs, and seed jobs.',
  environment: 'Scratch org creation and org setup / configuration jobs.',
  provisioning: 'Bulk user provisioning batch outcomes.',
  defects: 'Updates to assigned work items on the Developer Board (webhook driven).',
  system: 'General account, security, and administrative messages.',
};

/**
 * Delivery channels. In-app is the always-available inbox; additional channels
 * are opt-in and only fire when both the master switch and the channel are on.
 */
export const NOTIFICATION_CHANNELS = ['inApp', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  inApp: 'In-app inbox',
  email: 'Email',
};

export const NOTIFICATION_CHANNEL_DESCRIPTIONS: Record<NotificationChannel, string> = {
  inApp: 'Always-on bell inbox inside the app. Cannot be turned off while notifications are enabled.',
  email: 'Send a copy to the recipient by email (requires SMTP configuration on the server).',
};

export const NOTIFICATION_LEVELS = ['info', 'success', 'warning', 'error'] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export interface NotificationSettings {
  /**
   * Master switch. When false NOTHING is created or delivered — this is the
   * single control that keeps every notification off until an admin opts in.
   */
  enabled: boolean;
  channels: Record<NotificationChannel, boolean>;
  categories: Record<NotificationCategory, boolean>;
  updatedAt?: string;
  updatedBy?: string | null;
}

/**
 * Notifications are OFF by default. An administrator must explicitly enable
 * them before any alert is generated or sent.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  channels: { inApp: true, email: false },
  categories: {
    deployment: true,
    data: true,
    environment: true,
    provisioning: true,
    defects: true,
    system: true,
  },
};

function coerceBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Merge a partial / untrusted settings object (e.g. JSON column, request body)
 * onto the defaults so downstream code always sees every category and channel.
 * The in-app channel is pinned on — the inbox is the baseline delivery surface.
 */
export function normalizeNotificationSettings(raw: unknown): NotificationSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawChannels = (source.channels && typeof source.channels === 'object'
    ? source.channels
    : {}) as Record<string, unknown>;
  const rawCategories = (source.categories && typeof source.categories === 'object'
    ? source.categories
    : {}) as Record<string, unknown>;

  const channels = {} as Record<NotificationChannel, boolean>;
  for (const channel of NOTIFICATION_CHANNELS) {
    channels[channel] = coerceBool(
      rawChannels[channel],
      DEFAULT_NOTIFICATION_SETTINGS.channels[channel],
    );
  }
  // The in-app inbox is the guaranteed delivery surface and cannot be disabled.
  channels.inApp = true;

  const categories = {} as Record<NotificationCategory, boolean>;
  for (const category of NOTIFICATION_CATEGORIES) {
    categories[category] = coerceBool(
      rawCategories[category],
      DEFAULT_NOTIFICATION_SETTINGS.categories[category],
    );
  }

  const normalized: NotificationSettings = {
    enabled: coerceBool(source.enabled, DEFAULT_NOTIFICATION_SETTINGS.enabled),
    channels,
    categories,
  };
  if (typeof source.updatedAt === 'string') normalized.updatedAt = source.updatedAt;
  if (typeof source.updatedBy === 'string') normalized.updatedBy = source.updatedBy;
  return normalized;
}

/** Merge an admin update on top of current settings (partial toggles allowed). */
export function applyNotificationSettingsUpdate(
  current: NotificationSettings,
  update: NotificationSettingsUpdateInput,
): NotificationSettings {
  return normalizeNotificationSettings({
    enabled: update.enabled ?? current.enabled,
    channels: { ...current.channels, ...(update.channels ?? {}) },
    categories: { ...current.categories, ...(update.categories ?? {}) },
  });
}

/** A category only fires when the master switch is on AND the category is on. */
export function isCategoryEnabled(
  settings: NotificationSettings,
  category: NotificationCategory,
): boolean {
  return settings.enabled === true && settings.categories[category] !== false;
}

/** A channel only delivers when the master switch is on AND the channel is on. */
export function isChannelEnabled(
  settings: NotificationSettings,
  channel: NotificationChannel,
): boolean {
  return settings.enabled === true && settings.channels[channel] === true;
}

/** Resolve the notification category for a background queue name. */
export function queueToNotificationCategory(queue: string): NotificationCategory {
  switch (queue) {
    case QUEUE_NAMES.METADATA_DEPLOY:
      return 'deployment';
    case QUEUE_NAMES.SFDMU_RUN:
    case QUEUE_NAMES.DATA_DEPLOY:
    case QUEUE_NAMES.CONA_SEED:
    case QUEUE_NAMES.ACCOUNT_PARTNER_IMPORT:
      return 'data';
    case QUEUE_NAMES.SCRATCH_ORG_CREATE:
    case QUEUE_NAMES.ORG_SETUP:
      return 'environment';
    case QUEUE_NAMES.USER_PROVISION:
      return 'provisioning';
    default:
      return 'system';
  }
}

export function notificationLevelForStatus(status: string): NotificationLevel {
  switch (status) {
    case 'completed':
      return 'success';
    case 'partial':
      return 'warning';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'warning';
    default:
      return 'info';
  }
}

export interface NotificationRecord {
  id: string;
  category: NotificationCategory;
  level: NotificationLevel;
  title: string;
  body?: string | null;
  link?: string | null;
  jobId?: string | null;
  metadata?: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationRecord[];
  unreadCount: number;
  /** Whether the notifications feature is currently enabled by an administrator. */
  enabled: boolean;
  nextCursor?: string | null;
}

/** Payload used to create a notification (server-side). */
export interface NotificationInput {
  userId: string;
  category: NotificationCategory;
  level?: NotificationLevel;
  title: string;
  body?: string | null;
  link?: string | null;
  jobId?: string | null;
  metadata?: Record<string, unknown> | null;
}

const notificationChannelTogglesSchema = z
  .object({
    inApp: z.boolean().optional(),
    email: z.boolean().optional(),
  })
  .strict();

const notificationCategoryTogglesSchema = z
  .object({
    deployment: z.boolean().optional(),
    data: z.boolean().optional(),
    environment: z.boolean().optional(),
    provisioning: z.boolean().optional(),
    defects: z.boolean().optional(),
    system: z.boolean().optional(),
  })
  .strict();

export const notificationSettingsUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    channels: notificationChannelTogglesSchema.optional(),
    categories: notificationCategoryTogglesSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.enabled !== undefined ||
      value.channels !== undefined ||
      value.categories !== undefined,
    { message: 'At least one setting must be provided' },
  );

export type NotificationSettingsUpdateInput = z.infer<typeof notificationSettingsUpdateSchema>;

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().uuid().optional(),
  unreadOnly: z.coerce.boolean().optional().default(false),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

/** Per-user delivery preferences (self-service, non-privileged). */
export const notificationPreferencesUpdateSchema = z
  .object({
    emailNotifications: z.boolean(),
  })
  .strict();

export type NotificationPreferencesUpdateInput = z.infer<
  typeof notificationPreferencesUpdateSchema
>;

export interface NotificationPreferences {
  emailNotifications: boolean;
  /** Whether the server has a working SMTP transport configured. */
  emailConfigured: boolean;
  /** Whether the admin master switch + email channel are both on. */
  globalEmailEnabled: boolean;
}
