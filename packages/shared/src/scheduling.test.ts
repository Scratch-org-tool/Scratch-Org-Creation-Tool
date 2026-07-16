import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNextRun,
  deploymentScheduleSchema,
  describeSchedule,
  parseSchedule,
  type DeploymentSchedule,
} from './scheduling';

describe('deploymentScheduleSchema', () => {
  it('requires an hour for daily schedules', () => {
    assert.equal(
      deploymentScheduleSchema.safeParse({ frequency: 'daily', minute: 0 }).success,
      false,
    );
    assert.equal(
      deploymentScheduleSchema.safeParse({ frequency: 'daily', minute: 0, hour: 2 }).success,
      true,
    );
  });

  it('requires a dayOfWeek for weekly schedules', () => {
    assert.equal(
      deploymentScheduleSchema.safeParse({ frequency: 'weekly', minute: 0, hour: 2 }).success,
      false,
    );
    assert.equal(
      deploymentScheduleSchema.safeParse({
        frequency: 'weekly',
        minute: 0,
        hour: 2,
        dayOfWeek: 1,
      }).success,
      true,
    );
  });

  it('rejects out-of-range values', () => {
    assert.equal(
      deploymentScheduleSchema.safeParse({ frequency: 'hourly', minute: 60 }).success,
      false,
    );
    assert.equal(
      deploymentScheduleSchema.safeParse({ frequency: 'daily', minute: 0, hour: 24 }).success,
      false,
    );
  });
});

describe('computeNextRun', () => {
  it('advances to the next matching minute for hourly schedules', () => {
    const schedule: DeploymentSchedule = { frequency: 'hourly', minute: 30 };
    const from = new Date('2026-01-01T10:45:00.000Z');
    assert.equal(computeNextRun(schedule, from).toISOString(), '2026-01-01T11:30:00.000Z');
  });

  it('keeps the current hour when the minute is still ahead', () => {
    const schedule: DeploymentSchedule = { frequency: 'hourly', minute: 50 };
    const from = new Date('2026-01-01T10:45:00.000Z');
    assert.equal(computeNextRun(schedule, from).toISOString(), '2026-01-01T10:50:00.000Z');
  });

  it('rolls a daily schedule to the next day once the time has passed', () => {
    const schedule: DeploymentSchedule = { frequency: 'daily', minute: 0, hour: 2 };
    const from = new Date('2026-01-01T10:45:00.000Z');
    assert.equal(computeNextRun(schedule, from).toISOString(), '2026-01-02T02:00:00.000Z');
  });

  it('keeps a daily schedule today when the time is still ahead', () => {
    const schedule: DeploymentSchedule = { frequency: 'daily', minute: 15, hour: 23 };
    const from = new Date('2026-01-01T10:45:00.000Z');
    assert.equal(computeNextRun(schedule, from).toISOString(), '2026-01-01T23:15:00.000Z');
  });

  it('advances a weekly schedule to the target weekday', () => {
    // 2026-01-01 is a Thursday (day 4). Target Monday (1).
    const schedule: DeploymentSchedule = { frequency: 'weekly', minute: 0, hour: 6, dayOfWeek: 1 };
    const from = new Date('2026-01-01T10:45:00.000Z');
    assert.equal(computeNextRun(schedule, from).toISOString(), '2026-01-05T06:00:00.000Z');
  });

  it('rolls a weekly schedule a full week when today already passed', () => {
    // 2026-01-01 Thursday (4). Target Thursday (4) but time already passed.
    const schedule: DeploymentSchedule = { frequency: 'weekly', minute: 0, hour: 6, dayOfWeek: 4 };
    const from = new Date('2026-01-01T10:45:00.000Z');
    assert.equal(computeNextRun(schedule, from).toISOString(), '2026-01-08T06:00:00.000Z');
  });

  it('always returns a time strictly after the reference', () => {
    const schedule: DeploymentSchedule = { frequency: 'hourly', minute: 30 };
    const from = new Date('2026-01-01T10:30:00.000Z');
    assert.ok(computeNextRun(schedule, from).getTime() > from.getTime());
  });
});

describe('describeSchedule', () => {
  it('describes each frequency with an explicit UTC label', () => {
    assert.match(describeSchedule({ frequency: 'hourly', minute: 5 }), /Hourly.*UTC/);
    assert.equal(describeSchedule({ frequency: 'daily', minute: 30, hour: 2 }), 'Daily at 02:30 UTC');
    assert.equal(
      describeSchedule({ frequency: 'weekly', minute: 0, hour: 6, dayOfWeek: 1 }),
      'Weekly on Monday at 06:00 UTC',
    );
  });
});

describe('parseSchedule', () => {
  it('returns null for invalid input and the schedule for valid input', () => {
    assert.equal(parseSchedule({ frequency: 'nope' }), null);
    assert.deepEqual(parseSchedule({ frequency: 'hourly', minute: 15 }), {
      frequency: 'hourly',
      minute: 15,
    });
  });
});
