'use client';

import { useMemo, useState } from 'react';
import { Select } from '@/components/ui/input';
import { GlassCard } from '@/components/studio';
import type { JobDetailLogLine } from './types';

interface JobDetailLogsProps {
  logs: JobDetailLogLine[];
  logsTruncated?: boolean;
  logCount?: number;
  live?: boolean;
}

export function JobDetailLogs({ logs, logsTruncated, logCount, live }: JobDetailLogsProps) {
  const [streamFilter, setStreamFilter] = useState<'all' | 'stdout' | 'stderr'>('all');

  const filtered = useMemo(() => {
    if (streamFilter === 'all') return logs;
    return logs.filter((log) => log.stream === streamFilter);
  }, [logs, streamFilter]);

  return (
    <GlassCard
      title="Execution logs"
      description={
        logsTruncated
          ? `Showing latest ${logs.length} of ${logCount ?? logs.length} log lines`
          : `${logs.length} log line${logs.length === 1 ? '' : 's'}`
      }
      headerAction={
        <Select
          aria-label="Filter log stream"
          value={streamFilter}
          onChange={(e) => setStreamFilter(e.target.value as 'all' | 'stdout' | 'stderr')}
          className="h-8 text-xs w-[130px]"
        >
          <option value="all">All streams</option>
          <option value="stdout">stdout</option>
          <option value="stderr">stderr</option>
        </Select>
      }
    >
      <div className="rounded-lg border border-border/60 bg-black/40 font-mono text-xs max-h-[520px] overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="p-4 text-muted-foreground">
            {live ? 'Waiting for job output...' : 'No logs recorded for this job.'}
          </p>
        ) : (
          <div className="p-3 space-y-1">
            {filtered.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className={log.stream === 'stderr' ? 'text-red-400' : 'text-green-300'}
              >
                <span className="text-muted-foreground mr-2">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className="text-[10px] uppercase text-muted-foreground mr-2">{log.stream}</span>
                {log.line}
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
