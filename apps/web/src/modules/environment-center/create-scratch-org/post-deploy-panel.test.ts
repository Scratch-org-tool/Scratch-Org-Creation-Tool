import { describe, expect, it } from 'vitest';
import { resolvePostDeployDefaults } from './post-deploy-panel';

describe('resolvePostDeployDefaults', () => {
  it('preserves template datasets and matched partner behavior', () => {
    expect(resolvePostDeployDefaults({
      dataSeed: { datasets: ['Accounts', 'Products'] },
      partnerImport: {
        enabled: true,
        mode: 'org_to_org_matched',
        bottler: 'all',
      },
    })).toEqual({
      datasets: ['Accounts', 'Products'],
      partnerMode: 'org_to_org_matched',
      bottler: 'all',
    });
  });

  it('uses all datasets only when the template omits the dataset selection', () => {
    expect(resolvePostDeployDefaults({
      partnerImport: {
        enabled: true,
        mode: 'excel',
        bottler: '4900',
      },
    })).toEqual({
      datasets: ['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'],
      partnerMode: 'excel',
      bottler: '4900',
    });

    expect(resolvePostDeployDefaults({
      dataSeed: { datasets: [] },
    }).datasets).toEqual([]);
  });
});
