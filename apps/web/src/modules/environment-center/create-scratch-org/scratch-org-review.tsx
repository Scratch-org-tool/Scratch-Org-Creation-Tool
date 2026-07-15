'use client';

import type { ScratchOrgFormState } from '@/components/scratch-org/types';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';
import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';
import type { ResolvedTemplateV2Preview } from './template-v2-runtime';

interface ScratchOrgReviewProps {
  form: ScratchOrgFormState;
  installPackage: boolean;
  sourceControlConnected: boolean;
  templateMeta?: { name: string; config: ScratchPipelineTemplateConfig } | null;
  dataOrgAlias?: string;
  settingsOrgAlias?: string;
  templatePreview?: ResolvedTemplateV2Preview | null;
}

export function ScratchOrgReview({
  form,
  installPackage,
  sourceControlConnected,
  templateMeta,
  dataOrgAlias,
  settingsOrgAlias,
  templatePreview,
}: ScratchOrgReviewProps) {
  const cfg = templateMeta?.config;
  const customSettings = cfg?.customSettings as { mode?: string; enabled?: boolean } | undefined;
  const dataSeed = cfg?.dataSeed as { datasets?: string[] } | undefined;
  const users = cfg?.userProvisioning?.users;
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
  if (dataOrgAlias || form.dataDeploymentOrgId || form.sourceOrgId) {
    rows.push(['Data Deployment Org', dataOrgAlias ?? form.dataDeploymentOrgId ?? form.sourceOrgId]);
  }
  if (settingsOrgAlias || form.customSettingsOrgId) {
    rows.push(['Custom Settings Org', settingsOrgAlias ?? form.customSettingsOrgId]);
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
  if (templateMeta && (users?.length || templatePreview?.userCount)) {
    rows.push(['Resolved users', String(templatePreview?.userCount ?? users?.length ?? 0)]);
  }
  if (templatePreview?.queries) {
    rows.push([
      'Resolved queries',
      templatePreview.queries.queries.map((query) => `${query.stage}:${query.name}`).join(' → '),
    ]);
  }
  if (templateMeta && pipelineSteps) {
    const auto: string[] = [];
    if (pipelineSteps.autoRunDataSeed) auto.push('data seed');
    if (pipelineSteps.autoRunPartners) auto.push('partners');
    if (pipelineSteps.autoRunUsers) auto.push('users');
    if (auto.length) rows.push(['Auto-run', auto.join(', ')]);
  }

  return (
    <div className="space-y-4">
      {templatePreview?.errors.map((error) => (
        <p key={error} className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      ))}
      <dl className="space-y-3 text-sm rounded-lg border border-border/60 bg-card/30 p-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">{label}</dt>
            <dd className="font-medium text-right break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {templatePreview?.users.length ? (
        <div className="rounded-lg border border-border/60 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-left">
              <tr><th className="p-2">Role</th><th className="p-2">Email</th><th className="p-2">Username</th><th className="p-2">Access</th></tr>
            </thead>
            <tbody>
              {templatePreview.users.map((user, index) => (
                <tr key={`${user.generatorId ?? user.email}-${index}`} className="border-t border-border/50">
                  <td className="p-2">{user.role}</td>
                  <td className="p-2 break-all"><strong>Email:</strong> {user.email}</td>
                  <td className="p-2 break-all"><strong>Username:</strong> {user.username ?? 'Assigned at launch'}</td>
                  <td className="p-2">{[...user.modules, ...user.locations].join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
