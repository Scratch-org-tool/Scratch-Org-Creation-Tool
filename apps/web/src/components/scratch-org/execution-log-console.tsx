'use client';

import { useRef, useEffect, useState } from 'react';
import { Maximize2, Pin, PinOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

interface ExecutionLogConsoleProps {
  logs: string[];
  onClear?: () => void;
  className?: string;
  expanded?: boolean;
  fillHeight?: boolean;
  compact?: boolean;
  logHeightRem?: number;
  onToggleExpand?: () => void;
}

export function ExecutionLogConsole({
  logs,
  onClear,
  className,
  expanded,
  fillHeight,
  compact,
  logHeightRem,
  onToggleExpand,
}: ExecutionLogConsoleProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!autoScroll || !preRef.current) return;
    preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [logs, autoScroll]);

  return (
    <div
      className={cn(
        'rounded-lg border border-border overflow-hidden flex flex-col',
        fillHeight && 'h-full min-h-0',
        logHeightRem != null && 'shrink-0',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b border-border bg-card shrink-0',
          compact ? 'px-2 py-1' : 'px-3 py-2',
        )}
      >
        <span className={cn('font-medium text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
          Logs
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(compact ? 'h-6 w-6 p-0' : 'h-7 px-2 text-xs')}
            onClick={() => setAutoScroll((v) => !v)}
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
            aria-label={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            {autoScroll ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
            {!compact && <span className="ml-1">Auto-scroll</span>}
          </Button>
          {onClear && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(compact ? 'h-6 w-6 p-0' : 'h-7 px-2 text-xs')}
              onClick={onClear}
              title="Clear logs"
              aria-label="Clear logs"
            >
              <Trash2 className="w-3 h-3" />
              {!compact && <span className="ml-1">Clear</span>}
            </Button>
          )}
          {onToggleExpand && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(compact ? 'h-6 w-6 p-0' : 'h-7 w-7 p-0')}
              onClick={onToggleExpand}
              title="Expand logs"
              aria-label="Expand logs"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      <pre
        ref={preRef}
        className={cn(
          'studio-console scrollbar-thin overflow-y-auto overflow-x-hidden',
          compact ? 'p-2 text-[11px] leading-snug' : 'p-3 text-sm leading-relaxed',
          logHeightRem == null && fillHeight && 'flex-1 h-0 min-h-0',
          logHeightRem == null &&
            !fillHeight &&
            (expanded
              ? 'min-h-[70vh]'
              : compact
                ? 'h-44 max-h-44'
                : 'max-h-48 md:max-h-64'),
        )}
        style={logHeightRem != null ? { height: `${logHeightRem}rem`, maxHeight: `${logHeightRem}rem` } : undefined}
      >
        {logs.length ? logs.map((line, i) => (
          <div
            key={`${i}-${line.slice(0, 24)}`}
            className={cn(
              line.toLowerCase().includes('success') || line.toLowerCase().includes('complete')
                ? 'text-green-400'
                : line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')
                  ? 'text-red-400'
                  : '',
            )}
          >
            {line}
          </div>
        )) : (
          <span className="text-muted-foreground">Waiting for logs…</span>
        )}
      </pre>
    </div>
  );
}
