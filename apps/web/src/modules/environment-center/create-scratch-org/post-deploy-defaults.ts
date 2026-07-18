import type { AutomationRunView } from '@/components/scratch-org/types';

export const DATASET_OPTIONS = [
  'OnboardingConfig',
  'Products',
  'VisitPlans',
  'Accounts',
] as const;

export type Dataset = (typeof DATASET_OPTIONS)[number];
export type PartnerMode = 'excel' | 'org_to_org' | 'org_to_org_matched';
export type PartnerBottler = '5000' | '4900' | '4600' | 'all';

function isDataset(value: string): value is Dataset {
  return (DATASET_OPTIONS as readonly string[]).includes(value);
}

export function resolvePostDeployDefaults(config: AutomationRunView['config']) {
  const configuredDatasets = config?.dataSeed?.datasets;
  const mode = config?.partnerImport?.mode;

  return {
    datasets: configuredDatasets
      ? configuredDatasets.filter(isDataset)
      : [...DATASET_OPTIONS],
    partnerMode: (
      mode === 'excel' || mode === 'org_to_org' || mode === 'org_to_org_matched'
        ? mode
        : 'org_to_org_matched'
    ) as PartnerMode,
    bottler: (config?.partnerImport?.bottler ?? '5000') as PartnerBottler,
  };
}
