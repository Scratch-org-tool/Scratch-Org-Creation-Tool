'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SCRATCH_PERMISSION_SET } from '@sfcc/shared';
import { api, getStreamUrl } from '@/services/api';
import { fetchOrgsList } from '@/hooks/use-orgs';
import { getSessionCache } from '@/lib/session-cache';
import type { Org, OrgSetupTab } from './types';
import { ORG_SETUP_TABS } from './types';

const SAMPLE_CSV = `firstName,lastName,email,username,profile,permissionSets
John,Doe,john.doe@example.com,john.doe@example.com.scratch,Standard User,Admin
Jane,Smith,jane.smith@example.com,jane.smith@example.com.scratch,Standard User,Admin`;

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

export type AssignScope = 'default_user' | 'all_active_users';

interface BaselineJob {
  jobId: string;
  type: string;
}

interface JobData {
  id: string;
  status: string;
  error?: string | null;
  logs?: Array<{ line: string }>;
}

interface OrgSetupRun {
  id: string;
  setupType: string;
  status: string;
  createdAt: string;
}

function parseTab(param: string | null): OrgSetupTab {
  if (param && ORG_SETUP_TABS.includes(param as OrgSetupTab)) return param as OrgSetupTab;
  return 'baseline';
}

export function useOrgSetupWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));

  const [orgs, setOrgs] = useState<Org[]>(() => getSessionCache<Org[]>('orgs:list') ?? []);
  const [orgId, setOrgId] = useState('');
  const [permissionSets, setPermissionSets] = useState(SCRATCH_PERMISSION_SET);
  const [assignScope, setAssignScope] = useState<AssignScope>('all_active_users');
  const [availablePermSets, setAvailablePermSets] = useState<Array<{ name: string; label: string }>>(
    [],
  );
  const [theme, setTheme] = useState('lightning');
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineMessage, setBaselineMessage] = useState<{
    text: string;
    variant: 'success' | 'error' | 'info';
  } | null>(null);
  const [baselineJobs, setBaselineJobs] = useState<BaselineJob[]>([]);
  const [primaryJobId, setPrimaryJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [runs, setRuns] = useState<OrgSetupRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const logBottomRef = useRef<HTMLDivElement>(null);

  const [csvOrgId, setCsvOrgId] = useState('');
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [csvParsed, setCsvParsed] = useState<unknown[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvMessage, setCsvMessage] = useState<{
    text: string;
    variant: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setCsvParsed([]);
    setCsvMessage(null);
  }, [csv]);

  const loadRuns = useCallback(async () => {
    if (!orgId) {
      setRuns([]);
      return;
    }
    setRunsLoading(true);
    try {
      const data = await api<OrgSetupRun[]>(`/org-setup/runs?orgId=${orgId}`);
      setRuns(data);
    } catch {
      /* ignore */
    } finally {
      setRunsLoading(false);
    }
  }, [orgId]);

  const loadPermissionSets = useCallback(async () => {
    if (!orgId) {
      setAvailablePermSets([]);
      return;
    }
    try {
      const data = await api<{ permissionSets: Array<{ name: string; label: string }> }>(
        `/org-setup/permission-sets?orgId=${orgId}`,
      );
      setAvailablePermSets(data.permissionSets);
    } catch {
      setAvailablePermSets([]);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchOrgsList().then(setOrgs).catch(console.error);
  }, []);

  useEffect(() => {
    void loadPermissionSets();
    void loadRuns();
  }, [orgId, loadPermissionSets, loadRuns]);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!primaryJobId) return;
    const poll = setInterval(async () => {
      try {
        const data = await api<JobData>(`/jobs/${primaryJobId}`);
        setJob(data);
        if (data.logs?.length) setLogs(data.logs.map((l) => l.line));
        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(poll);
          void loadRuns();
        }
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [primaryJobId, loadRuns]);

  useEffect(() => {
    if (!primaryJobId) return;
    let es: EventSource | null = null;
    let cancelled = false;
    void (async () => {
      const url = await getStreamUrl(['job_log', 'job_status']);
      if (cancelled) return;
      es = new EventSource(url);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            payload: { jobId?: string; line?: string; status?: string; error?: string };
          };
          if (data.payload.jobId !== primaryJobId) return;
          if (data.type === 'job_status' && data.payload.status) {
            setJob((j) =>
              j
                ? { ...j, status: data.payload.status!, error: data.payload.error ?? j.error }
                : { id: primaryJobId, status: data.payload.status! },
            );
            if (TERMINAL_STATUSES.includes(data.payload.status)) void loadRuns();
          }
        } catch {
          /* ignore */
        }
      };
    })();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [primaryJobId, loadRuns]);

  const setTab = useCallback(
    (tab: OrgSetupTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'baseline') params.delete('tab');
      else params.set('tab', tab);
      const qs = params.toString();
      router.replace(qs ? `/org-setup?${qs}` : '/org-setup', { scroll: false });
    },
    [router, searchParams],
  );

  const executeBaseline = async () => {
    setBaselineLoading(true);
    setBaselineMessage(null);
    setLogs([]);
    setJob(null);
    setPrimaryJobId(null);
    setBaselineJobs([]);
    try {
      const res = await api<{ jobs: BaselineJob[] }>('/org-setup/execute', {
        method: 'POST',
        body: JSON.stringify({
          orgId,
          permissionSets: permissionSets
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          assignScope,
          theme,
        }),
      });
      setBaselineJobs(res.jobs);
      const permJob = res.jobs.find((j) => j.type === 'permission_sets') ?? res.jobs[0];
      if (permJob) {
        setPrimaryJobId(permJob.jobId);
        setJob({ id: permJob.jobId, status: 'queued' });
      }
      setBaselineMessage({
        text: 'Org setup started — watch progress below.',
        variant: 'info',
      });
    } catch (err) {
      setBaselineMessage({
        text: err instanceof Error ? err.message : 'Setup failed',
        variant: 'error',
      });
    } finally {
      setBaselineLoading(false);
    }
  };

  const parseCsv = async () => {
    setCsvLoading(true);
    setCsvMessage(null);
    try {
      const users = await api<unknown[]>('/provisioning/parse-csv', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      setCsvParsed(users);
      setCsvMessage({ text: `${users.length} users parsed`, variant: 'success' });
    } catch (err) {
      setCsvParsed([]);
      setCsvMessage({
        text: err instanceof Error ? err.message : 'CSV parsing failed',
        variant: 'error',
      });
    } finally {
      setCsvLoading(false);
    }
  };

  const provisionCsv = async () => {
    setCsvLoading(true);
    setCsvMessage(null);
    try {
      const users = await api<unknown[]>('/provisioning/parse-csv', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      const res = await api<{ batchId: string; totalUsers: number }>('/provisioning/bulk', {
        method: 'POST',
        body: JSON.stringify({ orgId: csvOrgId, users }),
      });
      setCsvMessage({
        text: `Provisioning ${res.totalUsers} users (batch: ${res.batchId})`,
        variant: 'success',
      });
    } catch (err) {
      setCsvMessage({
        text: err instanceof Error ? err.message : 'Provisioning failed',
        variant: 'error',
      });
    } finally {
      setCsvLoading(false);
    }
  };

  const baselineStatus = job?.status;
  const isBaselineRunning =
    baselineStatus === 'running' || baselineStatus === 'queued' || baselineStatus === 'pending';

  return {
    activeTab,
    setTab,
    orgs,
    orgId,
    setOrgId,
    permissionSets,
    setPermissionSets,
    assignScope,
    setAssignScope,
    availablePermSets,
    theme,
    setTheme,
    baselineLoading,
    baselineMessage,
    executeBaseline,
    baselineJobs,
    baselineStatus,
    isBaselineRunning,
    job,
    logs,
    logBottomRef,
    runs,
    runsLoading,
    csvOrgId,
    setCsvOrgId,
    csv,
    setCsv,
    csvParsed,
    csvLoading,
    csvMessage,
    parseCsv,
    provisionCsv,
  };
}

export type OrgSetupWorkspaceState = ReturnType<typeof useOrgSetupWorkspace>;
