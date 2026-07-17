'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Snowflake,
  Trash2,
} from 'lucide-react';
import {
  CALENDAR_EVENT_LABELS,
  type CalendarEvent,
  type CalendarEventKind,
  type FreezeWindowRecord,
} from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard, InlineAlert, PageHeader, StatusBadge } from '@/components/studio';
import { useAuth } from '@/contexts/auth-context';
import { useOrgs } from '@/hooks/use-orgs';
import { api } from '@/services/api';
import { cn } from '@/utils/cn';

const KIND_STYLES: Record<CalendarEventKind, string> = {
  freeze: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  scheduled_plan: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  release: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  drift_check: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  sandbox_refresh: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthTitle(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** All day cells for a month grid, starting on Monday. */
function buildMonthCells(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  const weekday = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - weekday);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    cells.push(day);
  }
  return cells;
}

function eventCoversDay(event: CalendarEvent, day: Date): boolean {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = dayStart + 86_400_000 - 1;
  const start = new Date(event.startAt).getTime();
  const end = new Date(event.endAt).getTime();
  return start <= dayEnd && end >= dayStart;
}

interface FreezeFormState {
  name: string;
  reason: string;
  startAt: string;
  endAt: string;
  orgConnectionIds: string[];
}

const EMPTY_FREEZE: FreezeFormState = {
  name: '',
  reason: '',
  startAt: '',
  endAt: '',
  orgConnectionIds: [],
};

export function CalendarWorkspace() {
  const { profile } = useAuth();
  const { orgs } = useOrgs();
  const isAdmin = profile?.role === 'admin';

  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [freezes, setFreezes] = useState<FreezeWindowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [showFreezeForm, setShowFreezeForm] = useState(false);
  const [freezeForm, setFreezeForm] = useState<FreezeFormState>(EMPTY_FREEZE);
  const [savingFreeze, setSavingFreeze] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState<string | null>(null);

  const cells = useMemo(() => buildMonthCells(anchor), [anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = cells[0];
    const to = new Date(cells[cells.length - 1]);
    to.setHours(23, 59, 59, 999);
    try {
      const [eventData, freezeData] = await Promise.all([
        api<CalendarEvent[]>(
          `/calendar/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        ),
        api<FreezeWindowRecord[]>('/calendar/freeze-windows'),
      ]);
      setEvents(eventData);
      setFreezes(freezeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [cells]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of cells) {
      const key = toDateKey(day);
      map.set(key, events.filter((event) => eventCoversDay(event, day)));
    }
    return map;
  }, [cells, events]);

  const selectedEvents = selectedDay ? (eventsByDay.get(toDateKey(selectedDay)) ?? []) : [];

  const createFreeze = async () => {
    setSavingFreeze(true);
    setError(null);
    try {
      await api('/calendar/freeze-windows', {
        method: 'POST',
        body: JSON.stringify({
          name: freezeForm.name.trim(),
          reason: freezeForm.reason.trim() || undefined,
          startAt: new Date(freezeForm.startAt).toISOString(),
          endAt: new Date(freezeForm.endAt).toISOString(),
          orgConnectionIds: freezeForm.orgConnectionIds,
        }),
      });
      setFreezeForm(EMPTY_FREEZE);
      setShowFreezeForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create freeze window');
    } finally {
      setSavingFreeze(false);
    }
  };

  const toggleFreeze = async (freeze: FreezeWindowRecord) => {
    setFreezeBusy(freeze.id);
    try {
      await api(`/calendar/freeze-windows/${freeze.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !freeze.enabled }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update freeze window');
    } finally {
      setFreezeBusy(null);
    }
  };

  const deleteFreeze = async (freeze: FreezeWindowRecord) => {
    setFreezeBusy(freeze.id);
    try {
      await api(`/calendar/freeze-windows/${freeze.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete freeze window');
    } finally {
      setFreezeBusy(null);
    }
  };

  const toggleFreezeOrg = (orgId: string) => {
    setFreezeForm((current) => ({
      ...current,
      orgConnectionIds: current.orgConnectionIds.includes(orgId)
        ? current.orgConnectionIds.filter((id) => id !== orgId)
        : [...current.orgConnectionIds, orgId],
    }));
  };

  const today = toDateKey(new Date());

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        title="Environment Calendar"
        subtitle="Scheduled deployments, drift checks, releases, sandbox refreshes, and freeze windows in one view."
        showBreadcrumbs={false}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden />
              Refresh
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowFreezeForm((current) => !current)}>
                <Snowflake aria-hidden />
                New freeze
              </Button>
            )}
          </>
        )}
      />

      {error && <InlineAlert variant="error" onDismiss={() => setError(null)}>{error}</InlineAlert>}

      {showFreezeForm && isAdmin && (
        <GlassCard
          title="New freeze window"
          description="While active, metadata and data deployments to the covered orgs are blocked. Validation-only runs stay allowed."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="freeze-name">Name</Label>
              <Input
                id="freeze-name"
                value={freezeForm.name}
                maxLength={120}
                onChange={(event) => setFreezeForm((c) => ({ ...c, name: event.target.value }))}
                placeholder="Quarter-end freeze"
              />
            </div>
            <div>
              <Label htmlFor="freeze-reason">Reason (optional)</Label>
              <Input
                id="freeze-reason"
                value={freezeForm.reason}
                maxLength={1000}
                onChange={(event) => setFreezeForm((c) => ({ ...c, reason: event.target.value }))}
                placeholder="Financial close"
              />
            </div>
            <div>
              <Label htmlFor="freeze-start">Starts</Label>
              <Input
                id="freeze-start"
                type="datetime-local"
                value={freezeForm.startAt}
                onChange={(event) => setFreezeForm((c) => ({ ...c, startAt: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="freeze-end">Ends</Label>
              <Input
                id="freeze-end"
                type="datetime-local"
                value={freezeForm.endAt}
                onChange={(event) => setFreezeForm((c) => ({ ...c, endAt: event.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm font-medium">Covered orgs</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Leave all unchecked to freeze every org.
            </p>
            <div className="flex flex-wrap gap-2">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => toggleFreezeOrg(org.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    freezeForm.orgConnectionIds.includes(org.id)
                      ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                      : 'border-border/60 text-muted-foreground hover:border-sky-500/30',
                  )}
                  aria-pressed={freezeForm.orgConnectionIds.includes(org.id)}
                >
                  {org.alias}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowFreezeForm(false)} disabled={savingFreeze}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void createFreeze()}
              loading={savingFreeze}
              disabled={!freezeForm.name.trim() || !freezeForm.startAt || !freezeForm.endAt}
            >
              Create freeze window
            </Button>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr] items-start">
        <GlassCard
          title={(
            <span className="flex items-center gap-3 text-base font-semibold">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              {monthTitle(anchor)}
            </span>
          )}
          headerAction={(
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft aria-hidden />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>
                Today
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          )}
        >
          {loading ? (
            <Skeleton className="h-[420px] rounded-lg" />
          ) : (
            <div>
              <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {WEEKDAYS.map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day) => {
                  const key = toDateKey(day);
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const inMonth = day.getMonth() === anchor.getMonth();
                  const isSelected = selectedDay && toDateKey(selectedDay) === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'flex min-h-[72px] flex-col items-stretch gap-1 rounded-lg border p-1.5 text-left transition-colors',
                        inMonth ? 'border-border/60' : 'border-border/30 opacity-50',
                        isSelected ? 'border-primary/60 bg-primary/10' : 'hover:border-primary/30',
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs',
                          key === today
                            ? 'inline-flex size-5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {day.getDate()}
                      </span>
                      <span className="flex flex-wrap gap-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className={cn('size-1.5 rounded-full border', KIND_STYLES[event.kind])}
                            title={`${CALENDAR_EVENT_LABELS[event.kind]}: ${event.title}`}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {(Object.keys(CALENDAR_EVENT_LABELS) as CalendarEventKind[]).map((kind) => (
                  <span key={kind} className="flex items-center gap-1.5">
                    <span className={cn('size-2 rounded-full border', KIND_STYLES[kind])} />
                    {CALENDAR_EVENT_LABELS[kind]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard
            title={selectedDay
              ? new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(selectedDay)
              : 'Day detail'}
            description={selectedDay ? undefined : 'Select a day to see its events.'}
          >
            {selectedDay && selectedEvents.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Nothing scheduled.</p>
            )}
            <ul className="space-y-1.5">
              {selectedEvents.map((event) => (
                <li
                  key={event.id}
                  className={cn('rounded-lg border px-3 py-2', KIND_STYLES[event.kind])}
                >
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    {CALENDAR_EVENT_LABELS[event.kind]}
                    {event.orgAlias ? ` · ${event.orgAlias}` : ''}
                    {event.detail ? ` · ${event.detail}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard
            title={(
              <span className="flex items-center gap-2 text-base font-semibold">
                <Snowflake className="size-4 text-sky-400" aria-hidden />
                Freeze windows
              </span>
            )}
            description="Deployments to covered orgs are blocked while a window is active."
          >
            {freezes.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No freeze windows defined{isAdmin ? ' — create one with "New freeze".' : '.'}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {freezes.map((freeze) => (
                  <li
                    key={freeze.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{freeze.name}</span>
                        {freeze.active && <StatusBadge status="running" label="active now" />}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(freeze.startAt).toLocaleString()} → {new Date(freeze.endAt).toLocaleString()}
                        {' · '}
                        {freeze.orgConnectionIds.length === 0
                          ? 'all orgs'
                          : `${freeze.orgConnectionIds.length} org${freeze.orgConnectionIds.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Switch
                          checked={freeze.enabled}
                          onChange={() => void toggleFreeze(freeze)}
                          disabled={freezeBusy === freeze.id}
                          size="sm"
                          aria-label={`Toggle ${freeze.name}`}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void deleteFreeze(freeze)}
                          disabled={freezeBusy === freeze.id}
                          aria-label={`Delete ${freeze.name}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
