'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { MetadataCompareHook } from './use-metadata-compare';

export function MetadataDeploySuccess({ w }: { w: MetadataCompareHook }) {
  const success = w.jobStatus === 'completed';
  const source = w.orgById(w.form.sourceOrgId)?.alias ?? 'Source';
  const target = w.orgById(w.form.targetOrgId)?.alias ?? 'Target';
  const duration =
    w.deployStartedAt && w.jobStatus && ['completed', 'failed', 'cancelled'].includes(w.jobStatus)
      ? Math.round((Date.now() - w.deployStartedAt) / 1000)
      : null;

  return (
    <div className="flex flex-col items-center text-center py-8">
      {success ? (
        <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-4" />
      ) : (
        <XCircle className="h-14 w-14 text-destructive mb-4" />
      )}
      <h2 className="text-lg font-semibold">
        {success ? 'Deployment successful' : 'Deployment finished'}
      </h2>
      <p className="text-sm text-muted-foreground mt-1 capitalize">{w.jobStatus ?? 'unknown'}</p>
      <p className="text-xs text-muted-foreground mt-2">
        {source} → {target}
      </p>
      {duration !== null && (
        <p className="text-xs text-muted-foreground mt-1">Duration: {duration}s</p>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {w.deployableCount} item(s) in deployment package
      </p>
      <div className="flex flex-wrap gap-2 justify-center mt-6">
        <Button variant="outline" onClick={w.resetFlow}>New comparison</Button>
        <Button variant="outline" onClick={() => void w.openHistory(w.deploymentId)}>View history</Button>
        {!success && (
          <Button onClick={() => w.setPhase('summary')}>Try again</Button>
        )}
      </div>
    </div>
  );
}
