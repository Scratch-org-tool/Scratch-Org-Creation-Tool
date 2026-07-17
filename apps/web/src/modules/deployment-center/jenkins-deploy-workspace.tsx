'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleStop,
  ExternalLink,
  Play,
  RefreshCw,
  Search,
  Wrench,
} from 'lucide-react';
import {
  jenkinsColorToStatus,
  jenkinsResultToStatus,
} from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DeploymentPageHeader,
  GlassCard,
  InlineAlert,
  StatusBadge,
} from '@/components/studio';
import { api } from '@/services/api';

interface JenkinsStatus {
  configured: boolean;
  reachable: boolean;
  version: string | null;
  url: string | null;
  error?: string;
}

interface JenkinsBuild {
  number: number;
  result: string | null;
  building: boolean;
  timestamp: number;
  durationMs: number;
  url?: string;
}

interface JenkinsJob {
  id: string;
  name: string;
  url?: string;
  color?: string;
  buildable?: boolean;
  lastBuild?: JenkinsBuild | null;
}

interface JenkinsParameter {
  name: string;
  type: string;
  description?: string;
  defaultValue?: string | boolean | null;
  choices?: string[];
}

interface JenkinsJobDetail extends JenkinsJob {
  description?: string | null;
  parameters: JenkinsParameter[];
  builds: JenkinsBuild[];
  inQueue?: boolean;
}

interface LogChunk {
  text: string;
  nextStart: number;
  hasMore: boolean;
  building: boolean;
}

function formatTimestamp(value: number): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDuration(ms: number): string {
  if (!ms) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function JenkinsDeployWorkspace() {
  const [status, setStatus] = useState<JenkinsStatus | null>(null);
  const [jobs, setJobs] = useState<JenkinsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [detail, setDetail] = useState<JenkinsJobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [triggering, setTriggering] = useState(false);
  const [notice, setNotice] = useState('');

  const [logBuild, setLogBuild] = useState<number | null>(null);
  const [logText, setLogText] = useState('');
  const [logBuilding, setLogBuilding] = useState(false);
  const logOffsetRef = useRef(0);
  const logTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const detailRequestRef = useRef(0);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, jobData] = await Promise.all([
        api<JenkinsStatus>('/jenkins/status'),
        api<JenkinsJob[]>('/jenkins/jobs'),
      ]);
      setStatus(statusData);
      setJobs(jobData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach Jenkins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const loadDetail = useCallback(async (path: string) => {
    const request = ++detailRequestRef.current;
    setSelectedPath(path);
    setDetail(null);
    setDetailLoading(true);
    setNotice('');
    try {
      const data = await api<JenkinsJobDetail>(`/jenkins/job?path=${encodeURIComponent(path)}`);
      if (detailRequestRef.current !== request) return;
      setDetail(data);
      const defaults: Record<string, string> = {};
      for (const param of data.parameters) {
        defaults[param.name] =
          param.defaultValue === null || param.defaultValue === undefined
            ? ''
            : String(param.defaultValue);
      }
      setParamValues(defaults);
    } catch (err) {
      if (detailRequestRef.current !== request) return;
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      if (detailRequestRef.current === request) setDetailLoading(false);
    }
  }, []);

  const stopLogPolling = useCallback(() => {
    if (logTimerRef.current) {
      clearTimeout(logTimerRef.current);
      logTimerRef.current = null;
    }
  }, []);

  const pollLog = useCallback(
    async (path: string, buildNumber: number) => {
      try {
        const chunk = await api<LogChunk>(
          `/jenkins/build/${buildNumber}/log?path=${encodeURIComponent(path)}&start=${logOffsetRef.current}`,
        );
        if (chunk.text) {
          setLogText((current) => current + chunk.text);
          requestAnimationFrame(() => {
            logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
          });
        }
        logOffsetRef.current = chunk.nextStart;
        setLogBuilding(chunk.hasMore);
        if (chunk.hasMore) {
          logTimerRef.current = setTimeout(() => void pollLog(path, buildNumber), 2000);
        } else if (selectedPath) {
          // Build finished — refresh history so the result column updates.
          void loadDetail(selectedPath);
        }
      } catch {
        setLogBuilding(false);
      }
    },
    [loadDetail, selectedPath],
  );

  const openLog = useCallback(
    (buildNumber: number) => {
      if (!selectedPath) return;
      stopLogPolling();
      setLogBuild(buildNumber);
      setLogText('');
      logOffsetRef.current = 0;
      void pollLog(selectedPath, buildNumber);
    },
    [pollLog, selectedPath, stopLogPolling],
  );

  useEffect(() => stopLogPolling, [stopLogPolling]);

  const trigger = async () => {
    if (!selectedPath) return;
    setTriggering(true);
    setNotice('');
    setError(null);
    try {
      const parameters: Record<string, string> = {};
      for (const [key, value] of Object.entries(paramValues)) {
        if (value !== '') parameters[key] = value;
      }
      const result = await api<{ queueId: number | null }>('/jenkins/trigger', {
        method: 'POST',
        body: JSON.stringify({
          path: selectedPath,
          parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
        }),
      });
      setNotice(
        result.queueId
          ? `Build queued (queue item #${result.queueId}). It will appear in the history shortly.`
          : 'Build request sent to Jenkins.',
      );
      // Poll the queue item briefly so the new build shows up and its log can stream.
      if (result.queueId) {
        void pollQueue(result.queueId);
      } else {
        setTimeout(() => void loadDetail(selectedPath), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger build');
    } finally {
      setTriggering(false);
    }
  };

  const pollQueue = async (queueId: number, attempt = 0) => {
    if (!selectedPath || attempt > 12) return;
    try {
      const item = await api<{ buildNumber: number | null; cancelled: boolean }>(
        `/jenkins/queue/${queueId}`,
      );
      if (item.buildNumber) {
        await loadDetail(selectedPath);
        openLog(item.buildNumber);
        return;
      }
      if (item.cancelled) return;
    } catch {
      // Queue item may not be readable yet; retry below.
    }
    setTimeout(() => void pollQueue(queueId, attempt + 1), 2500);
  };

  const stopBuild = async (buildNumber: number) => {
    if (!selectedPath) return;
    try {
      await api(`/jenkins/build/${buildNumber}/stop?path=${encodeURIComponent(selectedPath)}`, {
        method: 'POST',
      });
      setNotice(`Stop requested for build #${buildNumber}.`);
      setTimeout(() => void loadDetail(selectedPath), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop build');
    }
  };

  const filteredJobs = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return jobs;
    return jobs.filter((job) => job.name.toLowerCase().includes(query));
  }, [jobs, filter]);

  const notConfigured = status && !status.configured;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DeploymentPageHeader
        title="Jenkins"
        subtitle="Run Jenkins jobs, follow live console output, and monitor build status."
        icon={Wrench}
        accentClass="to-orange-500/10"
        showBreadcrumbs
        actions={(
          <Button variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden />
            Refresh
          </Button>
        )}
      />

      {error && (
        <InlineAlert variant="error" onDismiss={() => setError(null)}>
          {error}
        </InlineAlert>
      )}

      {notConfigured && (
        <InlineAlert variant="warning">
          Jenkins is not configured. Set JENKINS_URL, JENKINS_USER, and JENKINS_TOKEN in the API
          environment, then refresh this page.
        </InlineAlert>
      )}

      {status?.configured && !status.reachable && (
        <InlineAlert variant="error">
          Jenkins at {status.url} is not reachable{status.error ? `: ${status.error}` : '.'}
        </InlineAlert>
      )}

      {status?.configured && status.reachable && (
        <InlineAlert variant="success">
          Connected to Jenkins {status.version ? `v${status.version}` : ''} at {status.url}.
        </InlineAlert>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_2fr] items-start">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_2fr] items-start">
          <GlassCard
            title="Jobs"
            description={`${jobs.length} job${jobs.length === 1 ? '' : 's'} discovered (folders flattened).`}
          >
            <div className="relative mb-3">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter jobs…"
                className="pl-9"
                aria-label="Filter Jenkins jobs"
              />
            </div>
            <ul className="max-h-[440px] space-y-1 overflow-y-auto pr-1" aria-label="Jenkins jobs">
              {filteredJobs.length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {jobs.length === 0 ? 'No jobs found on this controller.' : 'No jobs match the filter.'}
                </li>
              )}
              {filteredJobs.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => void loadDetail(job.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selectedPath === job.id
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/60 hover:border-primary/30 hover:bg-secondary/40'
                    }`}
                  >
                    <span className="truncate">{job.name}</span>
                    <StatusBadge status={jenkinsColorToStatus(job.color)} />
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>

          <div className="space-y-4">
            {!selectedPath && (
              <GlassCard title="Job details">
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Select a job on the left to view parameters, trigger builds, and stream logs.
                </p>
              </GlassCard>
            )}

            {selectedPath && detailLoading && <Skeleton className="h-[320px] rounded-xl" />}

            {selectedPath && !detailLoading && detail && (
              <>
                <GlassCard
                  title={detail.name}
                  description={detail.description ?? 'Trigger a build with the parameters below.'}
                  headerAction={detail.url ? (
                    <a
                      href={detail.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open in Jenkins
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : undefined}
                >
                  {notice && (
                    <div className="mb-3">
                      <InlineAlert variant="success" onDismiss={() => setNotice('')}>
                        {notice}
                      </InlineAlert>
                    </div>
                  )}
                  <div className="space-y-3">
                    {detail.parameters.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {detail.parameters.map((param) => (
                          <div key={param.name}>
                            <Label htmlFor={`jenkins-param-${param.name}`}>{param.name}</Label>
                            {param.choices && param.choices.length > 0 ? (
                              <Select
                                id={`jenkins-param-${param.name}`}
                                value={paramValues[param.name] ?? ''}
                                onChange={(event) => setParamValues((current) => ({
                                  ...current,
                                  [param.name]: event.target.value,
                                }))}
                              >
                                {param.choices.map((choice) => (
                                  <option key={choice} value={choice}>{choice}</option>
                                ))}
                              </Select>
                            ) : param.type.toLowerCase().includes('boolean') ? (
                              <Select
                                id={`jenkins-param-${param.name}`}
                                value={paramValues[param.name] ?? 'false'}
                                onChange={(event) => setParamValues((current) => ({
                                  ...current,
                                  [param.name]: event.target.value,
                                }))}
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </Select>
                            ) : (
                              <Input
                                id={`jenkins-param-${param.name}`}
                                value={paramValues[param.name] ?? ''}
                                onChange={(event) => setParamValues((current) => ({
                                  ...current,
                                  [param.name]: event.target.value,
                                }))}
                                placeholder={param.description ?? ''}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      onClick={() => void trigger()}
                      loading={triggering}
                      disabled={detail.buildable === false}
                    >
                      <Play aria-hidden />
                      Trigger build
                    </Button>
                  </div>
                </GlassCard>

                <GlassCard title="Build history" description="Latest 20 builds. Click a row to stream its console log.">
                  <div className="max-h-[280px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Build</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 pr-3 font-medium">Started</th>
                          <th className="py-2 pr-3 font-medium">Duration</th>
                          <th className="py-2 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.builds.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-muted-foreground">
                              No builds yet.
                            </td>
                          </tr>
                        )}
                        {detail.builds.map((build) => (
                          <tr key={build.number} className="border-b border-border/40 last:border-0">
                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => openLog(build.number)}
                              >
                                #{build.number}
                              </button>
                            </td>
                            <td className="py-2 pr-3">
                              <StatusBadge status={jenkinsResultToStatus(build.result, build.building)} />
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">{formatTimestamp(build.timestamp)}</td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {build.building ? 'running…' : formatDuration(build.durationMs)}
                            </td>
                            <td className="py-2 text-right">
                              {build.building && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void stopBuild(build.number)}
                                >
                                  <CircleStop aria-hidden />
                                  Stop
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>

                {logBuild !== null && (
                  <GlassCard
                    title={`Console log — build #${logBuild}`}
                    description={logBuilding ? 'Streaming live output…' : 'Build finished.'}
                    headerAction={(
                      <Button size="sm" variant="ghost" onClick={() => {
                        stopLogPolling();
                        setLogBuild(null);
                        setLogText('');
                      }}>
                        Close
                      </Button>
                    )}
                  >
                    <pre
                      ref={logRef}
                      className="max-h-[360px] overflow-auto rounded-lg bg-black/60 p-3 font-mono text-xs leading-relaxed text-emerald-100"
                    >
                      {logText || 'Waiting for output…'}
                    </pre>
                  </GlassCard>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
