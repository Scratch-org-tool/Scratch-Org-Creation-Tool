'use client';

import {
  SCHEDULE_FREQUENCIES,
  SCHEDULE_FREQUENCY_LABELS,
  WEEKDAY_LABELS,
  describeSchedule,
  type DeploymentSchedule,
  type ScheduleFrequency,
} from '@sfcc/shared';
import { Input, Label, Select } from '@/components/ui/input';

interface ScheduleFieldsProps {
  value: DeploymentSchedule;
  onChange: (schedule: DeploymentSchedule) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/** Sensible defaults so switching frequency always yields a valid schedule. */
export const DEFAULT_SCHEDULE: DeploymentSchedule = { frequency: 'daily', minute: 0, hour: 2 };

function normalizeForFrequency(
  schedule: DeploymentSchedule,
  frequency: ScheduleFrequency,
): DeploymentSchedule {
  const next: DeploymentSchedule = { frequency, minute: schedule.minute };
  if (frequency === 'daily' || frequency === 'weekly') {
    next.hour = schedule.hour ?? 2;
  }
  if (frequency === 'weekly') {
    next.dayOfWeek = schedule.dayOfWeek ?? 1;
  }
  return next;
}

function clampNumber(raw: string, min: number, max: number): number {
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function ScheduleFields({ value, onChange, disabled, idPrefix = 'schedule' }: ScheduleFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-frequency`}>Frequency</Label>
          <Select
            id={`${idPrefix}-frequency`}
            value={value.frequency}
            disabled={disabled}
            onChange={(event) =>
              onChange(normalizeForFrequency(value, event.target.value as ScheduleFrequency))
            }
          >
            {SCHEDULE_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {SCHEDULE_FREQUENCY_LABELS[frequency]}
              </option>
            ))}
          </Select>
        </div>

        {value.frequency === 'weekly' && (
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-day`}>Day of week</Label>
            <Select
              id={`${idPrefix}-day`}
              value={String(value.dayOfWeek ?? 1)}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, dayOfWeek: Number(event.target.value) })}
            >
              {WEEKDAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {value.frequency !== 'hourly' && (
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-hour`}>Hour (UTC)</Label>
            <Input
              id={`${idPrefix}-hour`}
              type="number"
              min={0}
              max={23}
              value={value.hour ?? 0}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, hour: clampNumber(event.target.value, 0, 23) })}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-minute`}>Minute</Label>
          <Input
            id={`${idPrefix}-minute`}
            type="number"
            min={0}
            max={59}
            value={value.minute}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, minute: clampNumber(event.target.value, 0, 59) })}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {describeSchedule(value)} · times are in UTC
      </p>
    </div>
  );
}
