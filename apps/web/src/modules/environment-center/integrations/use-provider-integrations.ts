'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/services/api';
import type {
  ProjectBinding,
  PublicIntegrationConnection,
  ScmProvider,
  WorkItemProvider,
} from './types';

interface ConnectionsResponse {
  scm: PublicIntegrationConnection[];
  workItems: PublicIntegrationConnection[];
}

export type ConnectionKind = 'scm' | 'work-items';

export interface ConnectionAction {
  kind: ConnectionKind;
  provider: ScmProvider | WorkItemProvider;
  connection: PublicIntegrationConnection;
}

const EMPTY_CONNECTIONS: ConnectionsResponse = { scm: [], workItems: [] };

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useProviderIntegrations() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [connections, setConnections] = useState<ConnectionsResponse>(EMPTY_CONNECTIONS);
  const [bindings, setBindings] = useState<ProjectBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [nextConnections, nextBindings] = await Promise.all([
        api<ConnectionsResponse>('/integrations/admin/connections'),
        isAdmin
          ? api<ProjectBinding[]>('/integrations/admin/bindings').catch(() => [])
          : Promise.resolve([]),
      ]);
      setConnections(nextConnections);
      setBindings(nextBindings);
    } catch (cause) {
      setError(message(cause, 'Could not load source-control integrations.'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async (
    kind: ConnectionKind,
    provider: ScmProvider | WorkItemProvider,
    payload: Record<string, unknown>,
  ) => {
    setMutating(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/integrations/admin/${kind}/${provider}/connect`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setNotice('Connection verified and saved. Secret values are never returned to the browser.');
      await refresh();
    } catch (cause) {
      setError(message(cause, `Could not connect ${provider}.`));
      throw cause;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const verify = useCallback(async (action: ConnectionAction) => {
    setMutating(true);
    setError(null);
    setNotice(null);
    try {
      await api(
        `/integrations/admin/${action.kind}/${action.provider}/${action.connection.id}/verify`,
        { method: 'POST' },
      );
      setNotice(`${action.connection.displayName} was verified successfully.`);
      await refresh();
    } catch (cause) {
      setError(message(cause, 'Connection verification failed.'));
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async (action: ConnectionAction) => {
    setMutating(true);
    setError(null);
    setNotice(null);
    try {
      await api(
        `/integrations/admin/${action.kind}/${action.provider}/${action.connection.id}`,
        { method: 'DELETE' },
      );
      setNotice(`${action.connection.displayName} was disconnected.`);
      await refresh();
    } catch (cause) {
      setError(message(cause, 'Connection could not be disconnected.'));
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const saveBinding = useCallback(async (payload: Record<string, unknown>) => {
    setMutating(true);
    setError(null);
    setNotice(null);
    try {
      await api('/integrations/admin/bindings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setNotice('Workspace, project, and repository binding saved.');
      await refresh();
    } catch (cause) {
      setError(message(cause, 'Binding could not be saved.'));
      throw cause;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const deleteBinding = useCallback(async (id: string) => {
    setMutating(true);
    setError(null);
    try {
      await api(`/integrations/admin/bindings/${id}`, { method: 'DELETE' });
      setNotice('Binding removed.');
      await refresh();
    } catch (cause) {
      setError(message(cause, 'Binding could not be removed.'));
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const activeScm = useMemo(
    () => connections.scm.filter((connection) =>
      connection.status === 'connected' || connection.status === 'degraded'),
    [connections.scm],
  );

  return {
    isAdmin,
    connections,
    activeScm,
    bindings,
    loading,
    mutating,
    error,
    notice,
    setError,
    setNotice,
    refresh,
    connect,
    verify,
    disconnect,
    saveBinding,
    deleteBinding,
  };
}

export type ProviderIntegrationsState = ReturnType<typeof useProviderIntegrations>;
