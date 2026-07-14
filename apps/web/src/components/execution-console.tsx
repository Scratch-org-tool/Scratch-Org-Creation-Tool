'use client';

import { useEffect, useRef, useState } from 'react';
import { getStreamUrl } from '@/services/api';

interface ExecutionConsoleProps {
  runId?: string;
  jobId?: string;
}

export function ExecutionConsole({ runId, jobId }: ExecutionConsoleProps) {
  const [logs, setLogs] = useState<Array<{ stream: string; line: string; timestamp: string }>>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    void (async () => {
      const url = await getStreamUrl(['job_log', 'job_status']);
      if (cancelled) return;
      es = new EventSource(url);
      es.onerror = () => {
        es?.close();
      };
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            payload: { jobId?: string; stream?: string; line?: string; status?: string };
            timestamp: string;
          };
          if (data.type === 'job_log' && data.payload.line) {
            if (!jobId || data.payload.jobId === jobId) {
              setLogs((l) => [...l, {
                stream: data.payload.stream ?? 'stdout',
                line: data.payload.line!,
                timestamp: data.timestamp,
              }]);
            }
          }
        } catch { /* ignore */ }
      };
    })();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-black/50 rounded-lg border border-border font-mono text-xs">
      <div className="px-3 py-2 border-b border-border text-muted-foreground flex justify-between">
        <span>Execution Console</span>
        {runId && <span>Run: {runId.slice(0, 8)}...</span>}
      </div>
      <div className="h-64 overflow-y-auto scrollbar-thin p-3 space-y-0.5">
        {logs.length === 0 && (
          <p className="text-muted-foreground">Waiting for job output...</p>
        )}
        {logs.map((log, i) => (
          <div key={i} className={log.stream === 'stderr' ? 'text-red-400' : 'text-green-300'}>
            <span className="text-muted-foreground mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            {log.line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
