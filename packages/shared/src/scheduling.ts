import { z } from 'zod';

/**
 * Automation schedules for saved deployment plans and drift monitors.
 *
 * Schedules are intentionally structured (frequency + time-of-day) rather than
 * raw cron expressions: the next-run time can be computed deterministically
 * without a cron engine, which keeps the scheduler simple to reason about and
 * fully unit-testable. All times are interpreted in UTC — the UI labels them as
 * such so there is no hidden timezone ambiguity.
 */

export const SCHEDULE_FREQUENCIES = ['hourly', 'daily', 'weekly'] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export const SCHEDULE_FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
};

/** 0 = Sunday … 6 = Saturday (matches JS Date.getUTCDay). */
export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface DeploymentSchedule {
  frequency: ScheduleFrequency;
  /** Minute of the hour, 0–59. Used by every frequency. */
  minute: number;
  /** Hour of the day in UTC, 0–23. Required for daily and weekly. */
  hour?: number;
  /** Day of week, 0 (Sun)–6 (Sat). Required for weekly. */
  dayOfWeek?: number;
}

export const deploymentScheduleSchema = z
  .object({
    frequency: z.enum(SCHEDULE_FREQUENCIES),
    minute: z.number().int().min(0).max(59),
    hour: z.number().int().min(0).max(23).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.frequency === 'daily' || data.frequency === 'weekly') && data.hour === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `hour is required for ${data.frequency} schedules`,
        path: ['hour'],
      });
    }
    if (data.frequency === 'weekly' && data.dayOfWeek === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dayOfWeek is required for weekly schedules',
        path: ['dayOfWeek'],
      });
    }
  });

export type DeploymentScheduleInput = z.infer<typeof deploymentScheduleSchema>;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * Compute the next fire time strictly after `from` for a schedule, in UTC.
 * The result always has zero seconds/milliseconds.
 */
export function computeNextRun(schedule: DeploymentSchedule, from: Date = new Date()): Date {
  const minute = clampInt(schedule.minute, 0, 59);
  const next = new Date(from.getTime());
  next.setUTCSeconds(0, 0);

  if (schedule.frequency === 'hourly') {
    next.setUTCMinutes(minute);
    if (next.getTime() <= from.getTime()) {
      next.setUTCHours(next.getUTCHours() + 1);
    }
    return next;
  }

  const hour = clampInt(schedule.hour ?? 0, 0, 23);
  if (schedule.frequency === 'daily') {
    next.setUTCHours(hour, minute, 0, 0);
    if (next.getTime() <= from.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  // weekly
  const targetDow = clampInt(schedule.dayOfWeek ?? 0, 0, 6);
  next.setUTCHours(hour, minute, 0, 0);
  let deltaDays = (targetDow - next.getUTCDay() + 7) % 7;
  if (deltaDays === 0 && next.getTime() <= from.getTime()) {
    deltaDays = 7;
  }
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next;
}

/** Human-readable, timezone-explicit description, e.g. "Daily at 02:30 UTC". */
export function describeSchedule(schedule: DeploymentSchedule): string {
  const minute = clampInt(schedule.minute, 0, 59);
  if (schedule.frequency === 'hourly') {
    return `Hourly at :${pad2(minute)} past the hour (UTC)`;
  }
  const hour = clampInt(schedule.hour ?? 0, 0, 23);
  const time = `${pad2(hour)}:${pad2(minute)} UTC`;
  if (schedule.frequency === 'daily') {
    return `Daily at ${time}`;
  }
  const day = WEEKDAY_LABELS[clampInt(schedule.dayOfWeek ?? 0, 0, 6)];
  return `Weekly on ${day} at ${time}`;
}

/** Parse an unknown value into a DeploymentSchedule, or null when invalid. */
export function parseSchedule(value: unknown): DeploymentSchedule | null {
  const result = deploymentScheduleSchema.safeParse(value);
  return result.success ? result.data : null;
}

function clampInt(value: number, min: number, max: number): number {
  const int = Math.trunc(Number.isFinite(value) ? value : min);
  return Math.min(max, Math.max(min, int));
}
