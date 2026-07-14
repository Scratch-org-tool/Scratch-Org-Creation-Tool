'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStreamUrl } from '@/services/api';

export type StreamConnectionState = 'idle' | 'connected' | 'reconnecting' | 'disconnected';

interface JobLogPayload {
  jobId?: string;
  line?: string;
  stream?: string;
}

interface JobStatusPayload {
  jobId?: string;
  automationRunId?: string;
  status?: string;
  currentStep?: string;
}

interface UseJobEventStreamOptions {
  enabled?: boolean;
  jobIds?: string[];
  automationRunId?: string | null;
  onLog?: (line: string, jobId?: string) => void;
  onJobStatus?: (payload: JobStatusPayload) => void;
  onRunStatus?: (payload: JobStatusPayload) => void;
}

export function useJobEventStream({
  enabled = true,
  jobIds = [],
  automationRunId,
  onLog,
  onJobStatus,
  onRunStatus,
}: UseJobEventStreamOptions) {
  const [connectionState, setConnectionState] = useState<StreamConnectionState>('idle');
  const jobIdSetRef = useRef(new Set<string>());
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLogRef = useRef(onLog);
  const onJobStatusRef = useRef(onJobStatus);
  const onRunStatusRef = useRef(onRunStatus);
  onLogRef.current = onLog;
  onJobStatusRef.current = onJobStatus;
  onRunStatusRef.current = onRunStatus;

  useEffect(() => {
    jobIdSetRef.current = new Set(jobIds);
  }, [jobIds]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnectionState('idle');
      return;
    }

    let es: EventSource | null = null;
    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;
      setConnectionState((s) => (s === 'connected' ? s : 'reconnecting'));
      try {
        const url = await getStreamUrl(['job_log', 'job_status'], true);
        if (cancelled) return;

        es?.close();
        es = new EventSource(url);

        es.onopen = () => {
          backoffRef.current = 1000;
          setConnectionState('connected');
        };

        es.onerror = () => {
          setConnectionState('reconnecting');
          es?.close();
          es = null;
          if (cancelled) return;
          clearReconnectTimer();
          reconnectTimerRef.current = setTimeout(() => {
            void connect();
          }, backoffRef.current);
          backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
        };

        es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data as string) as {
              type: string;
              payload: JobLogPayload & JobStatusPayload;
            };

            if (data.type === 'job_log' && data.payload.line) {
              const jid = data.payload.jobId;
              const ids = jobIdSetRef.current;
              if (jid && ids.size > 0 && !ids.has(jid)) return;
              onLogRef.current?.(data.payload.line, jid);
            }

            if (data.type === 'job_status') {
              if (data.payload.jobId) {
                onJobStatusRef.current?.(data.payload);
              }
              if (
                automationRunId &&
                data.payload.automationRunId === automationRunId
              ) {
                onRunStatusRef.current?.(data.payload);
              }
            }
          } catch {
            /* ignore malformed events */
          }
        };
      } catch {
        setConnectionState('disconnected');
        if (!cancelled) {
          clearReconnectTimer();
          reconnectTimerRef.current = setTimeout(() => {
            void connect();
          }, backoffRef.current);
          backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      es?.close();
      setConnectionState('idle');
    };
  }, [enabled, automationRunId, clearReconnectTimer]);

  return { connectionState };
}
