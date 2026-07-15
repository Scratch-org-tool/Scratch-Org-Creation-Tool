'use client';

import { Button } from '@/components/ui/button';
import type { TemplateConfigState } from '../types';
import { TEMPLATE_WIZARD_STEPS } from '../types';
import { formatPermissionSets } from './permission-sets-editor';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';
import { countConfiguredUsers } from './user-provisioning-v2-section';

interface TemplateReviewProps {
  name: string;
  description: string;
  config: TemplateConfigState;
  orgAliases: Record<string, string>;
  onEditStep: (step: number) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-1.5 border-b border-border/40 last:border-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="font-medium text-right break-all">{value}</dd>
    </div>
  );
}

export function TemplateReview({ name, description, config, orgAliases, onEditStep }: TemplateReviewProps) {
  const dataOrg = config.dataDeploymentOrgId ?? config.sourceOrgId;
  const customSettingsEnabled = config.customSettings?.enabled !== false;
  const settingsOrg = customSettingsEnabled
    ? (config.customSettingsOrgId ?? config.sourceOrgId)
    : undefined;
  const userCount = countConfiguredUsers(config.userProvisioning);
  const querySection = config.dataSeed?.querySection;

  const sections = [
    {
      step: 0,
      title: 'General',
      rows: [
        ['Name', name],
        ['Description', description || '—'],
      ] as const,
    },
    {
      step: 1,
      title: 'Scratch org defaults',
      rows: [
        ['Scratch def', config.template ?? '—'],
        ['Duration', `${config.duration ?? 7} days`],
        ['Install package', config.installPackage ? 'Yes' : 'No'],
        [
          'Metadata provider',
          config.gitSource?.provider
            ? SCM_PROVIDER_LABELS[config.gitSource.provider]
            : config.azureDeploy
              ? 'Azure DevOps (legacy)'
              : '—',
        ],
        ['Default manifest', config.gitSource?.manifestPath ?? config.azureDeploy?.manifestPath ?? '—'],
      ] as const,
    },
    {
      step: 2,
      title: 'Source orgs',
      rows: [
        ['Data deployment org', dataOrg ? orgAliases[dataOrg] ?? dataOrg : '—'],
        [
          'Custom settings org',
          customSettingsEnabled
            ? (settingsOrg ? orgAliases[settingsOrg] ?? settingsOrg : '—')
            : 'Not used (disabled)',
        ],
      ] as const,
    },
    {
      step: 3,
      title: 'Custom settings',
      rows: [
        ['Enabled', config.customSettings?.enabled !== false ? 'Yes' : 'No'],
        [
          'Mode',
          customSettingsEnabled
            ? (config.customSettings?.mode === 'custom' ? 'Custom JSON' : 'Bundled')
            : 'Not applicable',
        ],
      ] as const,
    },
    {
      step: 4,
      title: 'Permissions & org config',
      rows: [
        ['Permission sets', formatPermissionSets(config.permissionSets) || '—'],
        ['Queue IDs', config.orgConfig?.upsertQueueIds ? 'Yes' : 'No'],
        ['Domain fields', config.orgConfig?.upsertDomainFields ? 'Yes' : 'No'],
        ['Request ID', config.orgConfig?.upsertRequestId ? 'Yes' : 'No'],
      ] as const,
    },
    {
      step: 5,
      title: 'Data seed',
      rows: [
        ['Seed mode', config.dataSeed?.mode ?? 'hybrid'],
        ['Datasets', config.dataSeed?.datasets?.join(', ') || '—'],
        ['Account rows', String(config.accountSeedRows?.length ?? 0)],
        ['Query JSON', config.dataSeed?.querySet ? 'Uploaded' : '—'],
      ] as const,
    },
    {
      step: 6,
      title: 'Query section',
      rows: [
        ['Name', querySection?.name ?? '—'],
        ['Enabled queries', String(querySection?.queries.filter((query) => query.enabled).length ?? 0)],
        ['Execution order', querySection?.queries.filter((query) => query.enabled).map((query) => `${query.stage}:${query.name}`).join(' → ') || '—'],
        ['Account partner join', querySection?.accountPartnerPlan ? 'Configured' : '—'],
        ['Legacy configuration retained', config.dataSeed?.querySet || config.accountSeedRows?.length ? 'Yes' : 'No'],
      ] as const,
    },
    {
      step: 7,
      title: 'Partners & users',
      rows: [
        ['Auto data seed', config.pipelineSteps?.autoRunDataSeed ? 'Yes' : 'No'],
        ['Auto partners', config.pipelineSteps?.autoRunPartners ? 'Yes' : 'No'],
        ['Auto users', config.pipelineSteps?.autoRunUsers ? 'Yes' : 'No'],
        ['Partner import', config.partnerImport?.enabled ? config.partnerImport.mode : 'Off'],
        ['Per office', String(config.partnerImport?.perOffice ?? 20)],
        ['Sales offices JSON', config.partnerImport?.salesOfficeConfig ? 'Yes' : '—'],
        ['User templates', String(config.userProvisioning?.templates?.length ?? 0)],
        ['User generators', String(config.userProvisioning?.userGenerators?.length ?? 0)],
        ['Role+bottler mappings', String(config.userProvisioning?.roleBottlerMappings?.length ?? 0)],
        ['Users / slots', String(userCount)],
      ] as const,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Repository and branch are chosen when you create a scratch org — not stored in this template.
      </p>
      {sections.map((s) => (
        <div key={s.title} className="rounded-lg border border-border/60 bg-card/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">{s.title}</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => onEditStep(s.step)}>
              Edit
            </Button>
          </div>
          <dl>
            {s.rows.map(([label, value]) => (
              <Row key={label} label={label} value={value} />
            ))}
          </dl>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Step {TEMPLATE_WIZARD_STEPS.length}: review complete — save to store this pipeline preset.
      </p>
    </div>
  );
}
