'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, getStreamUrl } from '@/services/api';
import { invalidateOrgsCache } from '@/hooks/use-orgs';
import { getSessionCache, hasFreshSessionCache, setSessionCache } from '@/lib/session-cache';
import type {
  AzureStatus,
  ConnectedOrg,
  IntegrationTab,
  SalesforceConnectForm,
  ScmProvider,
  ScratchOrg,
  ScratchOrgCredentials,
  OrgConnectType,
} from './types';
import { LOGIN_URL_PRODUCTION, LOGIN_URL_SANDBOX } from './types';
import { restoreDefaultFlags, setExclusiveDefault } from '@/lib/optimistic-domain';

function parseApiError(err: unknown, fallback: string) {
  if (!(err instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(err.message) as { message?: string | string[] };
    if (parsed.message) {
      return Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
    }
  } catch {
    /* use raw */
  }
  return err.message || fallback;
}

function instanceUrlForType(type: OrgConnectType, customUrl: string): string {
  if (type === 'sandbox') return LOGIN_URL_SANDBOX;
  if (type === 'production' || type === 'devhub') return LOGIN_URL_PRODUCTION;
  return customUrl || LOGIN_URL_PRODUCTION;
}

const DEFAULT_SF_FORM: SalesforceConnectForm = {
  alias: '',
  instanceUrl: LOGIN_URL_PRODUCTION,
  isDevHub: false,
  orgType: 'production',
};

const INTEGRATIONS_CACHE_KEY = 'integrations:workspace:v2';
const AUTHORIZATION_POLL_INTERVAL_MS = 1500;
const AUTHORIZATION_TIMEOUT_MS = 5.5 * 60 * 1000;

type IntegrationsCache = {
  orgs: ConnectedOrg[];
  scratchOrgs: ScratchOrg[];
  azureStatus: AzureStatus | null;
};

type AuthorizationStatus = {
  alias: string;
  status: 'authorizing' | 'authorized' | 'failed' | 'cancelled';
  error?: string;
};

export function useIntegrationsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: IntegrationTab =
    tabParam === 'azure' ||
    tabParam === 'github' ||
    tabParam === 'bitbucket' ||
    tabParam === 'source-control'
      ? 'source-control'
      : tabParam === 'jira' || tabParam === 'work-management'
        ? 'work-management'
        : 'salesforce';
  const sourceProvider: ScmProvider =
    tabParam === 'github' ? 'github' : tabParam === 'bitbucket' ? 'bitbucket' : 'azure_devops';

  const cached = getSessionCache<IntegrationsCache>(INTEGRATIONS_CACHE_KEY);
  const [initialLoading, setInitialLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [orgs, setOrgs] = useState<ConnectedOrg[]>(cached?.orgs ?? []);
  const [scratchOrgs, setScratchOrgs] = useState<ScratchOrg[]>(cached?.scratchOrgs ?? []);
  const [azureStatus, setAzureStatus] = useState<AzureStatus | null>(cached?.azureStatus ?? null);
  const [error, setError] = useState<string | null>(null);

  const [disconnectingAlias, setDisconnectingAlias] = useState<string | null>(null);
  const [defaultDevHubBusy, setDefaultDevHubBusy] = useState<Record<string, boolean>>({});
  const [defaultDevHubErrors, setDefaultDevHubErrors] = useState<Record<string, string>>({});
  const [optimisticAnnouncement, setOptimisticAnnouncement] = useState('');
  const [pendingDisconnect, setPendingDisconnect] = useState<string | null>(null);

  const [sfForm, setSfForm] = useState<SalesforceConnectForm>(DEFAULT_SF_FORM);
  const [authorizing, setAuthorizing] = useState(false);
  const [authorizingAlias, setAuthorizingAlias] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authVariant, setAuthVariant] = useState<'info' | 'success' | 'error'>('info');
  const abortRef = useRef<AbortController | null>(null);
  const activeAuthorizationAliasRef = useRef<string | null>(null);
  const defaultDevHubBusyRef = useRef(new Set<string>());
  const defaultDevHubSequenceRef = useRef(0);
  const orgsRequestRef = useRef(0);
  const orgMutationBusyRef = useRef(false);

  const [azureForm, setAzureForm] = useState({ orgSlug: '', pat: '', project: '' });
  const [azureSubmitting, setAzureSubmitting] = useState(false);
  const [azureMessage, setAzureMessage] = useState<{
    text: string;
    variant: 'success' | 'error' | 'info';
  } | null>(null);

  const [credentialsAlias, setCredentialsAlias] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<ScratchOrgCredentials | null>(null);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const setTab = useCallback(
    (tab: IntegrationTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`/environment-center?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const refreshOrgs = useCallback(async () => {
    const request = ++orgsRequestRef.current;
    try {
      const data = await api<ConnectedOrg[]>('/environment/connected-orgs/refresh', {
        method: 'POST',
      });
      if (orgsRequestRef.current === request) setOrgs(data);
    } catch (err) {
      const fallback = await api<ConnectedOrg[]>('/environment/connected-orgs').catch(() => []);
      if (orgsRequestRef.current === request) {
        setOrgs(fallback);
        setError(parseApiError(err, 'Could not sync from Salesforce CLI — showing cached orgs.'));
      }
    }
  }, []);

  const refreshScratchOrgs = useCallback(async () => {
    const [data, connections] = await Promise.all([
      api<ScratchOrg[]>('/environment/scratch-orgs'),
      api<Array<{ id: string; alias: string; type?: string }>>('/orgs').catch(() => []),
    ]);
    const connectionIds = new Map(
      connections
        .filter((connection) => connection.type === 'scratch')
        .map((connection) => [connection.alias, connection.id]),
    );
    setScratchOrgs(data.map((org) => ({
      ...org,
      orgConnectionId: connectionIds.get(org.alias),
    })));
  }, []);

  const applyAuthorizationStatus = useCallback((result: AuthorizationStatus): boolean => {
    if (
      !activeAuthorizationAliasRef.current
      || result.alias !== activeAuthorizationAliasRef.current
      || result.status === 'authorizing'
    ) {
      return false;
    }

    activeAuthorizationAliasRef.current = null;
    setAuthorizing(false);
    setAuthorizingAlias(null);

    if (result.status === 'authorized') {
      setAuthMessage(`Authorized: ${result.alias}`);
      setAuthVariant('success');
      setSfForm({ ...DEFAULT_SF_FORM });
      invalidateOrgsCache();
      void refreshOrgs();
      void refreshScratchOrgs().catch(() => undefined);
      return true;
    }

    setAuthMessage(
      result.error
      ?? (result.status === 'cancelled'
        ? 'Authorization cancelled.'
        : 'Authorization failed. Check the Salesforce login and try again.'),
    );
    setAuthVariant(result.status === 'cancelled' ? 'info' : 'error');
    return true;
  }, [refreshOrgs, refreshScratchOrgs]);

  const loadAzureStatus = useCallback(async () => {
    try {
      const s = await api<AzureStatus>('/environment/azure-connection');
      setAzureStatus(s);
      if (s.orgSlug) {
        setAzureForm((f) => ({ ...f, orgSlug: s.orgSlug ?? '', project: s.project ?? '' }));
      }
    } catch {
      setAzureStatus({ connected: false });
    }
  }, []);

  const refreshAll = useCallback(async (options?: { manual?: boolean }) => {
    const manual = options?.manual ?? false;
    if (manual) {
      setRefreshing(true);
    } else if (!getSessionCache<IntegrationsCache>(INTEGRATIONS_CACHE_KEY)) {
      setInitialLoading(true);
    }
    setError(null);
    try {
      await refreshOrgs();
      await refreshScratchOrgs();
      await loadAzureStatus();
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [refreshOrgs, refreshScratchOrgs, loadAzureStatus]);

  useEffect(() => {
    if (initialLoading) return;
    setSessionCache(INTEGRATIONS_CACHE_KEY, { orgs, scratchOrgs, azureStatus });
  }, [orgs, scratchOrgs, azureStatus, initialLoading]);

  useEffect(() => {
    if (hasFreshSessionCache(INTEGRATIONS_CACHE_KEY)) {
      setInitialLoading(false);
      return;
    }
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (searchParams.get('tab') !== 'salesforce') return;
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#scratch-orgs') {
      document.getElementById('scratch-orgs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams, initialLoading]);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    void (async () => {
      const url = await getStreamUrl(['auth_status']);
      if (cancelled) return;
      es = new EventSource(url);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            payload: { alias?: string; status?: string; error?: string };
          };
          if (data.type !== 'auth_status') return;
          const { alias, status, error: authErr } = data.payload;
          if (
            alias
            && (
              status === 'authorizing'
              || status === 'authorized'
              || status === 'failed'
              || status === 'cancelled'
            )
          ) {
            const handled = applyAuthorizationStatus({ alias, status, error: authErr });
            if (!handled && status === 'authorized') {
              invalidateOrgsCache();
              void refreshOrgs();
              void refreshScratchOrgs().catch(() => undefined);
            }
          }
        } catch {
          /* ignore */
        }
      };
    })().catch(() => {
      // Polling below is the fallback when the event stream is unavailable.
    });

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [applyAuthorizationStatus, refreshOrgs, refreshScratchOrgs]);

  useEffect(() => {
    if (!authorizing || !authorizingAlias) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const result = await api<AuthorizationStatus>(
          `/orgs/authorize/${encodeURIComponent(authorizingAlias)}/status`,
        );
        if (cancelled || applyAuthorizationStatus(result)) return;
      } catch {
        // A transient polling failure should not override a successful browser
        // login; the event stream or a later poll can still complete the flow.
      }

      if (cancelled) return;
      if (Date.now() - startedAt >= AUTHORIZATION_TIMEOUT_MS) {
        if (activeAuthorizationAliasRef.current === authorizingAlias) {
          activeAuthorizationAliasRef.current = null;
          setAuthorizing(false);
          setAuthorizingAlias(null);
          setAuthMessage('Authorization timed out. Finish or restart the Salesforce login.');
          setAuthVariant('error');
        }
        return;
      }
      timer = setTimeout(() => void poll(), AUTHORIZATION_POLL_INTERVAL_MS);
    };

    timer = setTimeout(() => void poll(), AUTHORIZATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [applyAuthorizationStatus, authorizing, authorizingAlias]);

  const setOrgType = (orgType: OrgConnectType) => {
    const isDevHub = orgType === 'devhub';
    const instanceUrl = instanceUrlForType(orgType, sfForm.instanceUrl);
    setSfForm((f) => ({ ...f, orgType, isDevHub, instanceUrl }));
  };

  const authorize = async () => {
    if (!sfForm.alias.trim()) return;
    const alias = sfForm.alias.trim();
    const payload = {
      alias,
      instanceUrl: sfForm.instanceUrl,
      isDevHub: sfForm.isDevHub,
    };
    activeAuthorizationAliasRef.current = alias;
    setAuthorizing(true);
    setAuthorizingAlias(alias);
    setAuthMessage('Opening browser for Salesforce login…');
    setAuthVariant('info');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await api('/orgs/authorize', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (activeAuthorizationAliasRef.current === alias) {
        setAuthMessage('Browser login opened. Finish signing in; this page will update automatically.');
        setAuthVariant('info');
      }
    } catch (err) {
      if (activeAuthorizationAliasRef.current !== alias) return;
      activeAuthorizationAliasRef.current = null;
      setAuthorizing(false);
      setAuthorizingAlias(null);
      if (err instanceof Error && err.name === 'AbortError') {
        setAuthMessage('Authorization stopped.');
      } else {
        setAuthMessage(parseApiError(err, 'Authorization failed'));
      }
      setAuthVariant('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const stopAuthorize = async () => {
    const alias = authorizingAlias ?? sfForm.alias;
    if (!alias) return;
    try {
      await api('/orgs/authorize/cancel', { method: 'POST', body: JSON.stringify({ alias }) });
    } catch {
      /* ignore */
    }
    abortRef.current?.abort();
    activeAuthorizationAliasRef.current = null;
    setAuthorizing(false);
    setAuthorizingAlias(null);
    setAuthMessage('Authorization cancelled.');
    setAuthVariant('info');
  };

  const setDefaultDevHub = async (alias: string) => {
    if (orgMutationBusyRef.current) return;
    orgMutationBusyRef.current = true;
    const token = ++defaultDevHubSequenceRef.current;
    orgsRequestRef.current += 1;
    const snapshot = orgs;
    defaultDevHubBusyRef.current.add(alias);
    setDefaultDevHubBusy((current) => ({ ...current, [alias]: true }));
    setDefaultDevHubErrors((current) => {
      const next = { ...current };
      delete next[alias];
      return next;
    });
    setOrgs((current) => setExclusiveDefault(current, alias));
    setOptimisticAnnouncement(`${alias} is being set as the default Dev Hub.`);
    try {
      const updated = await api<ConnectedOrg>(
        `/environment/connected-orgs/${encodeURIComponent(alias)}/default-dev-hub`,
        { method: 'POST' },
      );
      if (defaultDevHubSequenceRef.current !== token) return;
      setOrgs((current) => current.map((org) => org.alias === alias
        ? { ...org, ...updated, isDefaultDevHub: true }
        : { ...org, isDefaultDevHub: false }));
      setOptimisticAnnouncement(`${alias} is now the default Dev Hub.`);
    } catch (err) {
      if (defaultDevHubSequenceRef.current !== token) return;
      const failure = parseApiError(err, `Failed to set ${alias} as the default Dev Hub`);
      setOrgs((current) => restoreDefaultFlags(current, snapshot));
      setDefaultDevHubErrors((current) => ({ ...current, [alias]: failure }));
      setOptimisticAnnouncement(`Default Dev Hub change failed and was rolled back.`);
    } finally {
      defaultDevHubBusyRef.current.delete(alias);
      orgMutationBusyRef.current = false;
      setDefaultDevHubBusy((current) => {
        const next = { ...current };
        delete next[alias];
        return next;
      });
    }
  };

  const disconnectOrg = async (alias: string) => {
    if (orgMutationBusyRef.current) return;
    orgMutationBusyRef.current = true;
    orgsRequestRef.current += 1;
    setDisconnectingAlias(alias);
    setError(null);
    try {
      await api(`/environment/connected-orgs/${encodeURIComponent(alias)}`, { method: 'DELETE' });
      invalidateOrgsCache();
      setOrgs((list) => list.filter((o) => o.alias !== alias));
      setPendingDisconnect(null);
    } catch (err) {
      setError(parseApiError(err, 'Failed to disconnect org'));
    } finally {
      setDisconnectingAlias(null);
      orgMutationBusyRef.current = false;
    }
  };

  const azureConnect = async () => {
    setAzureSubmitting(true);
    setAzureMessage(null);
    try {
      await api('/environment/azure-connection/connect', {
        method: 'POST',
        body: JSON.stringify({
          orgSlug: azureForm.orgSlug.trim(),
          pat: azureForm.pat.trim(),
          ...(azureForm.project.trim() ? { project: azureForm.project.trim() } : {}),
        }),
      });
      setAzureMessage({ text: 'Azure DevOps connected successfully.', variant: 'success' });
      setAzureForm((f) => ({ ...f, pat: '' }));
      await loadAzureStatus();
    } catch (err) {
      setAzureMessage({
        text: parseApiError(err, 'Connection failed'),
        variant: 'error',
      });
    } finally {
      setAzureSubmitting(false);
    }
  };

  const azureVerify = async () => {
    setAzureSubmitting(true);
    setAzureMessage(null);
    try {
      await api('/environment/azure-connection/verify', { method: 'POST' });
      setAzureMessage({ text: 'Connection verified.', variant: 'success' });
    } catch (err) {
      setAzureMessage({
        text: parseApiError(err, 'Verification failed'),
        variant: 'error',
      });
    } finally {
      setAzureSubmitting(false);
    }
  };

  const azureDisconnect = async () => {
    setAzureSubmitting(true);
    try {
      await api('/environment/azure-connection', { method: 'DELETE' });
      setAzureMessage({ text: 'Azure DevOps disconnected.', variant: 'info' });
      setAzureStatus({ connected: false });
      setAzureForm({ orgSlug: '', pat: '', project: '' });
    } catch (err) {
      setAzureMessage({
        text: err instanceof Error ? err.message : 'Disconnect failed',
        variant: 'error',
      });
    } finally {
      setAzureSubmitting(false);
    }
  };

  const openCredentials = async (alias: string) => {
    setCredentialsAlias(alias);
    setLoadingCreds(true);
    setCredentials(null);
    try {
      const creds = await api<ScratchOrgCredentials>(
        `/environment/scratch-orgs/${encodeURIComponent(alias)}/credentials`,
      );
      setCredentials(creds);
    } catch (err) {
      setError(parseApiError(err, 'Failed to load credentials'));
      setCredentialsAlias(null);
    } finally {
      setLoadingCreds(false);
    }
  };

  const closeCredentials = () => {
    setCredentialsAlias(null);
    setCredentials(null);
    setCopiedField(null);
  };

  const copyText = async (field: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const regeneratePassword = async () => {
    if (!credentialsAlias) return;
    setRegenerating(true);
    try {
      const res = await api<{ password: string }>(
        `/environment/scratch-orgs/${encodeURIComponent(credentialsAlias)}/regenerate-password`,
        { method: 'POST' },
      );
      setCredentials((c) => (c ? { ...c, password: res.password, hasPassword: true } : c));
    } catch (err) {
      setError(parseApiError(err, 'Failed to regenerate password'));
    } finally {
      setRegenerating(false);
    }
  };

  const devHubCount = orgs.filter((o) => o.isDevHub).length;

  return {
    router,
    activeTab,
    sourceProvider,
    setTab,
    initialLoading,
    refreshing,
    orgs,
    scratchOrgs,
    azureStatus,
    error,
    setError,
    refreshAll,
    disconnectingAlias,
    pendingDisconnect,
    setPendingDisconnect,
    sfForm,
    setSfForm,
    setOrgType,
    authorizing,
    authMessage,
    authVariant,
    authorize,
    stopAuthorize,
    setDefaultDevHub,
    defaultDevHubBusy,
    defaultDevHubErrors,
    optimisticAnnouncement,
    disconnectOrg,
    azureForm,
    setAzureForm,
    azureSubmitting,
    azureMessage,
    azureConnect,
    azureVerify,
    azureDisconnect,
    credentialsAlias,
    credentials,
    loadingCreds,
    regenerating,
    copiedField,
    openCredentials,
    closeCredentials,
    copyText,
    regeneratePassword,
    devHubCount,
  };
}

export type IntegrationsWorkspaceState = ReturnType<typeof useIntegrationsWorkspace>;
