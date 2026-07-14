'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineAlert, StatusBadge } from '@/components/studio';
import { api } from '@/services/api';

export interface OrgConfigLoadResult {
  success: boolean;
  logs: string[];
  recordId?: string | null;
}

interface OrgConfigLoadActionProps {
  orgId: string;
  orgAlias?: string;
  className?: string;
  onComplete?: (result: OrgConfigLoadResult) => void;
}

type LoadPhase = 'idle' | 'loading' | 'completed' | 'error';

function warnLines(logs: string[]): string[] {
  return logs.filter((line) => line.includes('WARN:'));
}

export function OrgConfigLoadAction({
  orgId,
  orgAlias,
  className,
  onComplete,
}: OrgConfigLoadActionProps) {
  const [phase, setPhase] = useState<LoadPhase>('idle');
  const [message, setMessage] = useState<{ text: string; variant: 'success' | 'error' | 'warning' } | null>(
    null,
  );
  const [result, setResult] = useState<OrgConfigLoadResult | null>(null);

  async function run() {
    setPhase('loading');
    setMessage(null);
    setResult(null);
    try {
      const res = await api<OrgConfigLoadResult>(`/environment/orgs/${orgId}/load-config`, {
        method: 'POST',
        body: JSON.stringify({
          orgConfig: {
            upsertQueueIds: true,
            upsertDomainFields: true,
            upsertRequestId: true,
          },
        }),
      });
      const normalized: OrgConfigLoadResult = {
        success: res.success !== false,
        logs: Array.isArray(res.logs) ? res.logs : [],
        recordId: res.recordId,
      };
      const warnings = warnLines(normalized.logs);
      setResult(normalized);
      setPhase('completed');
      if (warnings.length > 0) {
        setMessage({
          text: `Org config updated with ${warnings.length} warning(s). Some queue IDs may be missing in the target org.`,
          variant: 'warning',
        });
      } else {
        setMessage({ text: 'Org config loaded successfully.', variant: 'success' });
      }
      onComplete?.(normalized);
    } catch (e) {
      setPhase('error');
      setMessage({
        text: e instanceof Error ? e.message : 'Load org config failed',
        variant: 'error',
      });
    }
  }

  const targetLabel = orgAlias ? `${orgAlias}` : orgId;
  const warnings = result ? warnLines(result.logs) : [];

  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground mb-3">
        Load org config on <span className="font-mono text-foreground">{targetLabel}</span> — looks up
        queues in the <strong>target</strong> org and sets{' '}
        <span className="font-mono">cfs_ob__OnboardingConfig__c</span> queue IDs, domain URLs, and
        request ID prefix. This is separate from SFDMU custom settings (portable thresholds/toggles).
      </p>

      {phase === 'completed' && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusBadge
            status={warnings.length > 0 ? 'running' : 'completed'}
            label={warnings.length > 0 ? 'Completed with warnings' : 'Completed'}
          />
          {result?.recordId && (
            <span className="text-xs text-muted-foreground font-mono">
              Record {result.recordId}
            </span>
          )}
        </div>
      )}

      <Button
        onClick={run}
        disabled={phase === 'loading'}
        variant={phase === 'completed' ? 'outline' : 'default'}
      >
        {phase === 'loading'
          ? 'Loading org config…'
          : phase === 'completed'
            ? 'Run again'
            : 'Run Load Org Config'}
      </Button>

      {message && (
        <InlineAlert
          variant={message.variant}
          title={
            message.variant === 'success'
              ? 'Completed'
              : message.variant === 'warning'
                ? 'Partial success'
                : 'Failed'
          }
          className="mt-3"
        >
          {message.text}
        </InlineAlert>
      )}

      {warnings.length > 0 && (
        <InlineAlert variant="warning" title="Queue mapping warnings" className="mt-3">
          <ul className="list-disc pl-4 space-y-0.5 text-xs">
            {warnings.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </InlineAlert>
      )}

      {result && result.logs.length > 0 && (
        <div className="mt-3 studio-console rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border/60 text-muted-foreground text-xs">
            Org config output
          </div>
          <div className="max-h-40 overflow-y-auto p-3 space-y-0.5 text-xs">
            {result.logs.map((line, i) => (
              <div key={i} className={line.includes('WARN:') ? 'text-amber-300' : undefined}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
