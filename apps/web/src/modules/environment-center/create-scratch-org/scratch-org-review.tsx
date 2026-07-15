'use client';

import type { ScratchOrgFormState } from '@/components/scratch-org/types';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';
import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';
import type { ResolvedTemplateV2Preview } from './template-v2-runtime';
import type {
  ExistingOrgEligibility,
  ExistingScratchOrgCandidate,
} from './types';
import { CheckCircle2, SkipForward } from 'lucide-react';
import { packageEligibilitySummary } from './existing-scratch-org-utils';

interface ScratchOrgReviewProps {
  form: ScratchOrgFormState;
  installPackage: boolean;
  sourceControlConnected: boolean;
  templateMeta?: { name: string; config: ScratchPipelineTemplateConfig } | null;
  dataOrgAlias?: string;
  settingsOrgAlias?: string;
  templatePreview?: ResolvedTemplateV2Preview | null;
  mode?: 'create_new' | 'configure_existing';
  existingTarget?: ExistingScratchOrgCandidate;
  eligibility?: ExistingOrgEligibility | null;
  existingOrgOptions?: {
    verifyAuthentication: boolean;
    ensureRequiredPackage: boolean;
  };
  destructiveConfirmed?: boolean;
  onDestructiveConfirmedChange?: (confirmed: boolean) => void;
  skipCreateConfirmed?: boolean;
  onSkipCreateConfirmedChange?: (confirmed: boolean) => void;
}

export function ScratchOrgReview({
  form,
  installPackage,
  sourceControlConnected,
  templateMeta,
  dataOrgAlias,
  settingsOrgAlias,
  templatePreview,
  mode = 'create_new',
  existingTarget,
  eligibility,
  existingOrgOptions,
  destructiveConfirmed,
  onDestructiveConfirmedChange,
  skipCreateConfirmed,
  onSkipCreateConfirmedChange,
}: ScratchOrgReviewProps) {
  const cfg = templatePreview?.config ?? templateMeta?.config;
  const customSettings = cfg?.customSettings as { mode?: string; enabled?: boolean } | undefined;
  const dataSeed = cfg?.dataSeed as { datasets?: string[] } | undefined;
  const users = cfg?.userProvisioning?.users;
  const pipelineSteps = cfg?.pipelineSteps as {
    autoRunDataSeed?: boolean;
    autoRunPartners?: boolean;
    autoRunUsers?: boolean;
  } | undefined;

  const rows: [string, string][] = mode === 'configure_existing'
    ? [
        ['Mode', 'Configure existing'],
        ['Target', existingTarget?.alias ?? form.alias],
        ['Org connection ID', existingTarget?.orgConnectionId ?? 'Not selected'],
      ]
    : [
        ['Dev Hub', form.devHubAlias],
        ['Alias', form.alias],
      ];

  if (templateMeta) {
    rows.push(['Template', templateMeta.name]);
  } else if (mode === 'create_new') {
    rows.push(['Duration', `${form.duration} days`], ['Scratch def', form.template]);
  }

  if (form.description && mode === 'create_new') rows.push(['Description', form.description]);
  const resolvedDataOrgId = cfg?.dataDeploymentOrgId ?? cfg?.sourceOrgId;
  const resolvedSettingsOrgId = customSettings?.enabled === false
    ? undefined
    : cfg?.customSettingsOrgId;
  if (dataOrgAlias || resolvedDataOrgId || form.dataDeploymentOrgId || form.sourceOrgId) {
    rows.push([
      'Data Deployment Org',
      dataOrgAlias ?? resolvedDataOrgId ?? form.dataDeploymentOrgId ?? form.sourceOrgId,
    ]);
  }
  if (customSettings?.enabled !== false && (
    settingsOrgAlias || resolvedSettingsOrgId || form.customSettingsOrgId
  )) {
    rows.push([
      'Custom Settings Org',
      settingsOrgAlias ?? resolvedSettingsOrgId ?? form.customSettingsOrgId,
    ]);
  }
  if (sourceControlConnected) {
    rows.push([
      'Metadata source',
      `${form.gitProvider ? SCM_PROVIDER_LABELS[form.gitProvider] : 'Git'} · ${form.azureRepo} / ${form.azureBranch}`,
    ]);
  }
  if (form.azureManifestPath) rows.push(['Manifest', form.azureManifestPath]);
  if (mode === 'create_new') rows.push(['Install package', installPackage ? 'Yes' : 'No']);

  if (templateMeta) {
    rows.push([
      'Custom settings',
      customSettings?.enabled === false
        ? 'Disabled'
        : customSettings?.mode === 'custom' ? 'Custom JSON' : 'Bundled',
    ]);
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
      <h3 id="scratch-org-review-title" tabIndex={-1} className="sr-only">
        Review scratch org pipeline
      </h3>
      {templatePreview?.errors.map((error) => (
        <p key={error} className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      ))}
      {templatePreview?.warnings.map((warning) => (
        <p key={warning} className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-600">{warning}</p>
      ))}
      <dl className="space-y-3 text-sm rounded-lg border border-border/60 bg-card/30 p-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">{label}</dt>
            <dd className="font-medium text-right break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {mode === 'configure_existing' && (
        <>
          <section
            className="rounded-lg border border-border/60 bg-card/30 p-4"
            aria-labelledby="will-run-title"
          >
            <h4 id="will-run-title" className="text-sm font-medium mb-3">Will Run</h4>
            <ol className="space-y-2 text-xs">
              {[
                ['Create scratch org', 'Skipped — using the selected existing org', true],
                ['Generate password', 'Skipped — existing credentials are preserved', true],
                ['Retrieve newly created org details', 'Skipped — target details already exist', true],
                [
                  'Prepare existing org',
                  `${existingOrgOptions?.verifyAuthentication ? 'Verify authentication' : 'Skip authentication verification'}; ${
                    packageEligibilitySummary(
                      existingOrgOptions?.ensureRequiredPackage ?? true,
                      eligibility?.steps.find((step) => step.step === 'required_package')?.messages,
                    )
                  }`,
                  false,
                ],
                ['Deploy Git metadata', `${form.azureRepo} / ${form.azureBranch}`, false],
                ['Assign permission set', 'Run after metadata deployment', false],
                ['Load custom settings and org configuration', 'Use resolved template and runtime overrides', false],
                ['Run ordered queries, partner data, and users', 'Continue with Template V2 post-deploy actions', false],
              ].map(([label, detail, skipped], index) => (
                <li key={String(label)} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full border border-border flex items-center justify-center shrink-0">
                    {skipped
                      ? <SkipForward className="w-3 h-3 text-muted-foreground" />
                      : <CheckCircle2 className="w-3 h-3 text-primary" />}
                  </span>
                  <span>
                    <strong>{index + 1}. {label}</strong>
                    <span className="block text-muted-foreground mt-0.5">{detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <fieldset className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <legend className="px-1 text-sm font-medium">Deployment confirmations</legend>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={destructiveConfirmed}
                onChange={(event) => onDestructiveConfirmedChange?.(event.target.checked)}
              />
              <span>I understand this deployment may overwrite or remove configuration in the selected org.</span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={skipCreateConfirmed}
                onChange={(event) => onSkipCreateConfirmedChange?.(event.target.checked)}
              />
              <span>I confirm the pipeline must skip org creation, password generation, and new-org detail retrieval.</span>
            </label>
          </fieldset>
        </>
      )}
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
                  <td className="p-2">
                    Profile: {user.profile ?? '—'}<br />
                    Permission sets: {user.permissionSets?.join(', ') || '—'}<br />
                    {[...user.modules, ...user.locations].join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
