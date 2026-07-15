'use client';

import type { ScratchOrgFormState } from '@/components/scratch-org/types';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';

interface ScratchOrgReviewProps {
  form: ScratchOrgFormState;
  installPackage: boolean;
  sourceControlConnected: boolean;
  templateMeta?: { name: string; config: Record<string, unknown> } | null;
  sourceOrgAlias?: string;
}

export function ScratchOrgReview({
  form,
  installPackage,
  sourceControlConnected,
  templateMeta,
  sourceOrgAlias,
}: ScratchOrgReviewProps) {
  const cfg = templateMeta?.config;
  const customSettings = cfg?.customSettings as { mode?: string; enabled?: boolean } | undefined;
  const dataSeed = cfg?.dataSeed as { datasets?: string[] } | undefined;
  const users = (cfg?.userProvisioning as { users?: unknown[] } | undefined)?.users;
  const pipelineSteps = cfg?.pipelineSteps as {
    autoRunDataSeed?: boolean;
    autoRunPartners?: boolean;
    autoRunUsers?: boolean;
  } | undefined;

  const rows: [string, string][] = [
    ['Dev Hub', form.devHubAlias],
    ['Alias', form.alias],
  ];

  if (templateMeta) {
    rows.push(['Template', templateMeta.name]);
  } else {
    rows.push(['Duration', `${form.duration} days`], ['Scratch def', form.template]);
  }

  if (form.description) rows.push(['Description', form.description]);
  if (sourceOrgAlias || form.sourceOrgId) {
    rows.push(['Source org', sourceOrgAlias ?? form.sourceOrgId]);
  }
  if (sourceControlConnected) {
    rows.push([
      'Metadata source',
      `${form.gitProvider ? SCM_PROVIDER_LABELS[form.gitProvider] : 'Git'} · ${form.azureRepo} / ${form.azureBranch}`,
    ]);
  }
  if (form.azureManifestPath) rows.push(['Manifest', form.azureManifestPath]);
  rows.push(['Install package', installPackage ? 'Yes' : 'No']);

  if (templateMeta && customSettings?.enabled !== false) {
    rows.push(['Custom settings', customSettings?.mode === 'custom' ? 'Custom JSON' : 'Bundled']);
  }
  if (templateMeta && dataSeed?.datasets?.length) {
    rows.push(['Data seed', dataSeed.datasets.join(', ')]);
  }
  if (templateMeta && users?.length) {
    rows.push(['Users', String(users.length)]);
  }
  if (templateMeta && pipelineSteps) {
    const auto: string[] = [];
    if (pipelineSteps.autoRunDataSeed) auto.push('data seed');
    if (pipelineSteps.autoRunPartners) auto.push('partners');
    if (pipelineSteps.autoRunUsers) auto.push('users');
    if (auto.length) rows.push(['Auto-run', auto.join(', ')]);
  }

  return (
    <dl className="space-y-3 text-sm rounded-lg border border-border/60 bg-card/30 p-4">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground shrink-0">{label}</dt>
          <dd className="font-medium text-right break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
