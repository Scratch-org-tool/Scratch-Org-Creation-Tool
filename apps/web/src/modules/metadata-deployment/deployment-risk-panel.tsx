'use client';

import { useState } from 'react';
import { ShieldAlert, Sparkles } from 'lucide-react';
import type { DeploymentRiskResult, MetadataSelection, RiskLevel } from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import { cn } from '@/utils/cn';

const LEVEL_STYLES: Record<RiskLevel, { bar: string; text: string; label: string }> = {
  low: { bar: 'bg-emerald-500', text: 'text-emerald-400', label: 'Low risk' },
  medium: { bar: 'bg-amber-500', text: 'text-amber-400', label: 'Medium risk' },
  high: { bar: 'bg-orange-500', text: 'text-orange-400', label: 'High risk' },
  critical: { bar: 'bg-red-500', text: 'text-red-400', label: 'Critical risk' },
};

interface DeploymentRiskPanelProps {
  targetOrgId: string;
  sourceOrgId?: string;
  selections: MetadataSelection[];
  destructiveSelections?: MetadataSelection[];
  testLevel?: string;
}

type RiskResponse = DeploymentRiskResult & { narrative: string | null };

export function DeploymentRiskPanel({
  targetOrgId,
  sourceOrgId,
  selections,
  destructiveSelections,
  testLevel,
}: DeploymentRiskPanelProps) {
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<RiskResponse>('/deployments/risk-score', {
        method: 'POST',
        body: JSON.stringify({
          targetOrgId,
          sourceOrgId,
          selections,
          destructiveSelections,
          testLevel,
          narrative: true,
        }),
      });
      setRisk(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Risk analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ShieldAlert className="size-4 text-primary" aria-hidden />
          Deployment risk
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void analyze()}
          loading={loading}
          disabled={!targetOrgId || selections.length === 0}
        >
          <Sparkles aria-hidden />
          {risk ? 'Re-analyze' : 'Analyze risk'}
        </Button>
      </div>

      {error && (
        <div className="mt-2">
          <InlineAlert variant="error" onDismiss={() => setError(null)}>{error}</InlineAlert>
        </div>
      )}

      {risk && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className={cn('font-semibold', LEVEL_STYLES[risk.level].text)}>
                {LEVEL_STYLES[risk.level].label}
              </span>
              <span className="tabular-nums text-muted-foreground">{risk.score}/100</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn('h-full rounded-full transition-all', LEVEL_STYLES[risk.level].bar)}
                style={{ width: `${Math.max(risk.score, 4)}%` }}
              />
            </div>
          </div>

          {risk.narrative && (
            <p className="rounded-md bg-secondary/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
              {risk.narrative}
            </p>
          )}

          <ul className="space-y-1">
            {risk.factors
              .filter((factor) => factor.triggered)
              .map((factor) => (
                <li key={factor.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span>
                    <span className="font-medium text-foreground">{factor.label}</span>
                    <span className="text-muted-foreground"> — {factor.detail} (+{factor.weight})</span>
                  </span>
                </li>
              ))}
            {risk.factors.every((factor) => !factor.triggered) && (
              <li className="text-xs text-muted-foreground">No risk factors triggered.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
