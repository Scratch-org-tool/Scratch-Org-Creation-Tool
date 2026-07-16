'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, getStreamUrl } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import type { NotificationListResponse, NotificationRecord } from '@sfcc/shared';
import { NotificationsSheet } from './notifications-sheet';

interface NotificationsContextValue {
  notifications: NotificationRecord[];
  unreadCount: number;
  enabled: boolean;
  loading: boolean;
  open: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const PAGE_SIZE = 30;
const MAX_ITEMS = 200;

type IncomingPayload = Partial<NotificationRecord> & { id?: string };

function toRecord(payload: IncomingPayload): NotificationRecord | null {
  if (!payload.id || typeof payload.title !== 'string' || !payload.createdAt) return null;
  return {
    id: payload.id,
    category: payload.category ?? 'system',
    level: payload.level ?? 'info',
    title: payload.title,
    body: payload.body ?? null,
    link: payload.link ?? null,
    jobId: payload.jobId ?? null,
    metadata: payload.metadata ?? null,
    read: payload.read ?? false,
    createdAt: payload.createdAt,
  };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const notificationsRef = useRef<NotificationRecord[]>([]);
  notificationsRef.current = notifications;

  const applyPage = useCallback((data: NotificationListResponse, append: boolean) => {
    setEnabled(data.enabled);
    setUnreadCount(data.unreadCount);
    setCursor(data.nextCursor ?? null);
    setNotifications((current) => {
      const base = append ? [...current] : [];
      if (!append) seenIdsRef.current = new Set();
      for (const record of data.notifications) {
        if (seenIdsRef.current.has(record.id)) continue;
        seenIdsRef.current.add(record.id);
        base.push(record);
      }
      return base;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<NotificationListResponse>(`/notifications?limit=${PAGE_SIZE}`);
      applyPage(data, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [applyPage]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api<NotificationListResponse>(
        `/notifications?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`,
      );
      applyPage(data, true);
    } catch {
      /* keep existing list on pagination failure */
    } finally {
      setLoadingMore(false);
    }
  }, [applyPage, cursor, loadingMore]);

  const pushIncoming = useCallback((record: NotificationRecord) => {
    if (seenIdsRef.current.has(record.id)) return;
    seenIdsRef.current.add(record.id);
    setEnabled(true);
    setNotifications((current) => [record, ...current].slice(0, MAX_ITEMS));
    if (!record.read) setUnreadCount((count) => count + 1);
  }, []);

  const markRead = useCallback((id: string) => {
    const target = notificationsRef.current.find((n) => n.id === id);
    if (!target || target.read) return;
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    void api(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }).catch(
      () => undefined,
    );
  }, []);

  const markAllRead = useCallback(() => {
    if (notificationsRef.current.every((n) => n.read)) return;
    setNotifications((current) => current.map((n) => (n.read ? n : { ...n, read: true })));
    setUnreadCount(0);
    void api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
  }, []);

  // Load history + open a live SSE stream whenever the signed-in user changes.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setEnabled(false);
      setCursor(null);
      seenIdsRef.current = new Set();
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let backoff = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let connectedOnce = false;

    void refresh();

    const clearTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = async () => {
      if (cancelled) return;
      try {
        const url = await getStreamUrl(['notification'], true);
        if (cancelled) return;
        es?.close();
        es = new EventSource(url);

        es.onopen = () => {
          backoff = 1000;
          // Resync after a reconnect so events missed while offline appear.
          if (connectedOnce) void refresh();
          connectedOnce = true;
        };

        es.onerror = () => {
          es?.close();
          es = null;
          if (cancelled) return;
          clearTimer();
          reconnectTimer = setTimeout(() => void connect(), backoff);
          backoff = Math.min(backoff * 2, 30_000);
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string) as {
              type?: string;
              payload?: IncomingPayload;
            };
            if (data.type !== 'notification' || !data.payload) return;
            const record = toRecord(data.payload);
            if (record) pushIncoming(record);
          } catch {
            /* ignore malformed events */
          }
        };
      } catch {
        if (cancelled) return;
        clearTimer();
        reconnectTimer = setTimeout(() => void connect(), backoff);
        backoff = Math.min(backoff * 2, 30_000);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      clearTimer();
      es?.close();
    };
  }, [user, refresh, pushIncoming]);

  const open = useCallback(() => {
    setIsOpen(true);
    // Opening the inbox is a natural moment to reconcile with the server.
    if (user) void refresh();
  }, [refresh, user]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount, enabled, loading, open }),
    [notifications, unreadCount, enabled, loading, open],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationsSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        notifications={notifications}
        unreadCount={unreadCount}
        enabled={enabled}
        loading={loading}
        error={error}
        hasMore={cursor !== null}
        loadingMore={loadingMore}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onLoadMore={loadMore}
      />
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
}
