'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Camera, FlaskConical, Play, RefreshCw } from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DeploymentPageHeader,
  GlassCard,
  InlineAlert,
  StatCard,
  StatusBadge,
  relativeTime,
} from '@/components/studio';
import { useOrgs } from '@/hooks/use-orgs';
import { api } from '@/services/api';

interface ApexRun {
  id: string;
  orgConnectionId: string;
  alias: string;
  testLevel: string;
  status: string;
  outcome: string | null;
  testsRan: number | null;
  passing: number | null;
  failing: number | null;
  skipped: number | null;
  testRunCoverage: number | null;
  orgWideCoverage: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface ApexRunDetail extends ApexRun {
  tests: Array<{
    ApexClass?: { Name?: string };
    MethodName?: string;
    Outcome?: string;
    RunTime?: number;
    Message?: string | null;
  }>;
}

interface CoverageResponse {
  orgId: string;
  alias: string;
  current: number | null;
  snapshots: Array<{ percentCovered: number; source: string; capturedAt: string }>;
}

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: 'hsl(222 47% 9%)',
    border: '1px solid hsl(217 33% 20%)',
    borderRadius: '8px',
    fontSize: '12px',
  },
  labelStyle: { color: 'hsl(215 20% 65%)' },
};

export function QualityWorkspace() {
  const searchParams = useSearchParams();
  const { orgs } = useOrgs();
  const [orgId, setOrgId] = useState(searchParams.get('org') ?? '');
  const [testLevel, setTestLevel] = useState<'RunLocalTests' | 'RunAllTestsInOrg'>('RunLocalTests');
  const [runs, setRuns] = useState<ApexRun[]>([]);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [selectedRun, setSelectedRun] = useState<ApexRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [runData, coverageData] = await Promise.all([
        api<ApexRun[]>(`/quality/apex/runs${orgId ? `?orgId=${orgId}` : ''}`),
        orgId ? api<CoverageResponse>(`/quality/apex/coverage?orgId=${orgId}`) : Promise.resolve(null),
      ]);
      setRuns(runData);
      setCoverage(coverageData);
      const active = runData.some((run) => run.status === 'running' || run.status === 'pending');
      if (pollRef.current) clearTimeout(pollRef.current);
      if (active) {
        pollRef.current = setTimeout(() => void load(true), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quality data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [load]);

  const startRun = async () => {
    if (!orgId) return;
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      await api('/quality/apex/run', {
        method: 'POST',
        body: JSON.stringify({ orgId, testLevel }),
      });
      setNotice('Apex test run started. Results appear here when the run finishes.');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start test run');
    } finally {
      setStarting(false);
    }
  };

  const captureCoverage = async () => {
    if (!orgId) return;
    setCapturing(true);
    setError(null);
    try {
      await api('/quality/apex/coverage/capture', {
        method: 'POST',
        body: JSON.stringify({ orgId }),
      });
      await load(true);
      setNotice('Org-wide coverage captured.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture coverage');
    } finally {
      setCapturing(false);
    }
  };

  const openRun = async (id: string) => {
    try {
      setSelectedRun(await api<ApexRunDetail>(`/quality/apex/runs/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run detail');
    }
  };

  const latest = runs[0];
  const chartData = useMemo(
    () =>
      (coverage?.snapshots ?? []).map((snapshot) => ({
        date: new Date(snapshot.capturedAt).toLocaleDateString(),
        coverage: snapshot.percentCovered,
      })),
    [coverage],
  );

  const failingTests = useMemo(
    () => (selectedRun?.tests ?? []).filter((test) => test.Outcome === 'Fail'),
    [selectedRun],
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DeploymentPageHeader
        title="Apex Quality"
        subtitle="Run Apex tests, track pass rates, and watch org-wide code coverage over time."
        icon={FlaskConical}
        accentClass="to-emerald-500/10"
        showBreadcrumbs
        actions={(
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden />
            Refresh
          </Button>
        )}
      />

      {error && <InlineAlert variant="error" onDismiss={() => setError(null)}>{error}</InlineAlert>}
      {notice && <InlineAlert variant="success" onDismiss={() => setNotice(null)}>{notice}</InlineAlert>}

      <GlassCard title="Run Apex tests" description="Runs asynchronously against the selected org; one run at a time per org.">
        <div className="grid items-end gap-3 sm:grid-cols-[2fr_2fr_auto_auto]">
          <div>
            <Label htmlFor="quality-org">Org</Label>
            <Select id="quality-org" value={orgId} onChange={(event) => setOrgId(event.target.value)}>
              <option value="">Select org…</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>{org.alias}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="quality-level">Test level</Label>
            <Select
              id="quality-level"
              value={testLevel}
              onChange={(event) => setTestLevel(event.target.value as typeof testLevel)}
            >
              <option value="RunLocalTests">Local tests (skip managed packages)</option>
              <option value="RunAllTestsInOrg">All tests in org</option>
            </Select>
          </div>
          <Button onClick={() => void startRun()} loading={starting} disabled={!orgId}>
            <Play aria-hidden />
            Run tests
          </Button>
          <Button variant="outline" onClick={() => void captureCoverage()} loading={capturing} disabled={!orgId}>
            <Camera aria-hidden />
            Capture coverage
          </Button>
        </div>
      </GlassCard>

      {orgId && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Org-wide coverage"
            value={coverage?.current !== null && coverage !== undefined && coverage !== null
              ? `${coverage.current?.toFixed(1)}%`
              : '—'}
            trend={coverage && coverage.current !== null && coverage.current < 75
              ? 'Below the 75% deploy floor'
              : 'Salesforce requires 75% to deploy'}
          />
          <StatCard
            label="Last run outcome"
            value={latest?.outcome ?? '—'}
            trend={latest ? relativeTime(latest.startedAt) : 'No runs yet'}
          />
          <StatCard
            label="Last pass / fail"
            value={latest ? `${latest.passing ?? 0} / ${latest.failing ?? 0}` : '—'}
            trend={latest?.testsRan ? `${latest.testsRan} tests ran` : ''}
          />
          <StatCard
            label="Runs recorded"
            value={String(runs.length)}
            trend="Most recent 50 shown"
          />
        </div>
      )}

      {orgId && chartData.length > 1 && (
        <GlassCard title="Coverage trend" description="Org-wide Apex coverage from test runs and manual captures.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="coverage-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="hsl(215 20% 45%)" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="hsl(215 20% 45%)" fontSize={11} tickLine={false} unit="%" />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="coverage"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#coverage-grad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <GlassCard title="Test run history" description="Click a run to inspect failures.">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No test runs yet{orgId ? ' for this org' : ''}.
            </p>
          ) : (
            <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {runs.map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => void openRun(run.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                      selectedRun?.id === run.id
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/60 hover:border-primary/30 hover:bg-secondary/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{run.alias} · {run.testLevel}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {relativeTime(run.startedAt)}
                        {run.testsRan !== null ? ` · ${run.testsRan} tests` : ''}
                        {run.failing ? ` · ${run.failing} failing` : ''}
                        {run.testRunCoverage !== null ? ` · ${run.testRunCoverage}% run coverage` : ''}
                      </p>
                    </div>
                    <StatusBadge status={run.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard
          title={selectedRun ? `Run detail — ${selectedRun.alias}` : 'Run detail'}
          description={selectedRun
            ? `${selectedRun.outcome ?? selectedRun.status} · ${selectedRun.testsRan ?? 0} tests`
            : 'Select a run on the left.'}
        >
          {!selectedRun ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Failures and slowest tests appear here.
            </p>
          ) : selectedRun.error ? (
            <InlineAlert variant="error">{selectedRun.error}</InlineAlert>
          ) : (
            <div className="space-y-4">
              {failingTests.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-destructive">
                    Failing tests ({failingTests.length})
                  </p>
                  <ul className="max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
                    {failingTests.map((test, index) => (
                      <li key={index} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                        <p className="text-sm font-medium">
                          {test.ApexClass?.Name}.{test.MethodName}
                        </p>
                        {test.Message && (
                          <p className="mt-0.5 break-words text-xs text-muted-foreground">{test.Message}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <InlineAlert variant="success">All tests passed in this run.</InlineAlert>
              )}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Slowest tests
                </p>
                <ul className="space-y-1">
                  {[...(selectedRun.tests ?? [])]
                    .sort((a, b) => (b.RunTime ?? 0) - (a.RunTime ?? 0))
                    .slice(0, 5)
                    .map((test, index) => (
                      <li key={index} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {test.ApexClass?.Name}.{test.MethodName}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{test.RunTime ?? 0} ms</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
