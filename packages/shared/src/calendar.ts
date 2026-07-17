import { z } from 'zod';

// ---------------------------------------------------------------------------
// Freeze windows
// ---------------------------------------------------------------------------

export const freezeWindowCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    reason: z.string().trim().max(1000).optional(),
    /** Org connection ids covered by the freeze; empty = every org. */
    orgConnectionIds: z.array(z.string().uuid()).max(100).default([]),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    enabled: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Date(value.endAt).getTime() <= new Date(value.startAt).getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endAt'],
        message: 'The freeze must end after it starts',
      });
    }
  });

export type FreezeWindowCreateInput = z.infer<typeof freezeWindowCreateSchema>;

export const freezeWindowUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    reason: z.string().trim().max(1000).nullable().optional(),
    orgConnectionIds: z.array(z.string().uuid()).max(100).optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type FreezeWindowUpdateInput = z.infer<typeof freezeWindowUpdateSchema>;

export interface FreezeWindowRecord {
  id: string;
  name: string;
  reason?: string | null;
  orgConnectionIds: string[];
  startAt: string;
  endAt: string;
  enabled: boolean;
  active: boolean;
  createdBy: string;
  createdAt: string;
}

export function isFreezeWindowActive(
  window: { enabled: boolean; startAt: Date | string; endAt: Date | string },
  now: Date = new Date(),
): boolean {
  if (!window.enabled) return false;
  const start = new Date(window.startAt).getTime();
  const end = new Date(window.endAt).getTime();
  return now.getTime() >= start && now.getTime() <= end;
}

/** Whether an active window covers a specific org connection. */
export function freezeWindowCoversOrg(
  window: { orgConnectionIds: string[] },
  orgConnectionId: string,
): boolean {
  return window.orgConnectionIds.length === 0 || window.orgConnectionIds.includes(orgConnectionId);
}

// ---------------------------------------------------------------------------
// Calendar events
// ---------------------------------------------------------------------------

export const CALENDAR_EVENT_KINDS = [
  'freeze',
  'scheduled_plan',
  'release',
  'drift_check',
  'sandbox_refresh',
] as const;

export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

export const CALENDAR_EVENT_LABELS: Record<CalendarEventKind, string> = {
  freeze: 'Freeze window',
  scheduled_plan: 'Scheduled deployment',
  release: 'Release',
  drift_check: 'Drift check',
  sandbox_refresh: 'Sandbox refresh',
};

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  /** ISO start; for point-in-time events end equals start. */
  startAt: string;
  endAt: string;
  link?: string | null;
  detail?: string | null;
  orgAlias?: string | null;
}

export const calendarRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});
