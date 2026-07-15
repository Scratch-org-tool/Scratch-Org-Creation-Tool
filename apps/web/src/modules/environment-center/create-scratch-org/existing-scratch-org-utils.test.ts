import { describe, expect, it } from 'vitest';
import {
  buildExistingScratchOrgCandidates,
  isActiveRecentRun,
  isCandidateSelectable,
  packageEligibilitySummary,
} from './existing-scratch-org-utils';
import { getStepStates } from '../../../components/scratch-org/types';

describe('configure-existing scratch org utilities', () => {
  it('joins owned scratch rows to authoritative connection ids and latest runs', () => {
    const latest = {
      id: 'run-1',
      status: 'running',
      targetOrgConnectionId: 'connection-1',
    };
    const candidates = buildExistingScratchOrgCandidates(
      [{
        id: 'scratch-1',
        alias: 'existing',
        username: 'scratch@example.com',
        status: 'Active',
        expirationDate: '2099-01-01T00:00:00.000Z',
        devHubAlias: 'hub',
      }],
      [{
        id: 'connection-1',
        alias: 'existing',
        type: 'scratch',
        status: 'active',
      }],
      [latest],
      Date.parse('2026-01-01T00:00:00.000Z'),
    );

    expect(candidates).toEqual([expect.objectContaining({
      orgConnectionId: 'connection-1',
      alias: 'existing',
      authenticated: true,
      latestRun: latest,
    })]);
    expect(isCandidateSelectable(candidates[0])).toBe(true);
    expect(isActiveRecentRun(candidates[0].latestRun)).toBe(true);
  });

  it('excludes scratch rows without a scratch OrgConnection', () => {
    expect(buildExistingScratchOrgCandidates(
      [{ id: 'orphan', alias: 'orphan', status: 'Active' }],
      [],
      [],
    )).toEqual([]);
  });

  it('describes conditional package preparation from eligibility', () => {
    expect(packageEligibilitySummary(true, ['Required package is already installed']))
      .toContain('already installed');
    expect(packageEligibilitySummary(true, ['Required package will be installed']))
      .toContain('install');
    expect(packageEligibilitySummary(false)).toContain('Skip');
  });

  it('marks creation details skipped and preparation active for existing runs', () => {
    const options = {
      run: {
        id: 'run',
        status: 'running',
        checkpoint: { completedSteps: ['scratch_org_create'] },
        jobs: [{
          id: 'prepare',
          status: 'running',
          currentStep: 'Preparing',
          type: 'prepare_existing_org',
        }],
      },
      skippedSteps: new Set<'installPackages' | 'deployMetadata' | 'assignPermissions'>(),
      sourceControlConnected: true,
      launchMode: 'configure_existing' as const,
    };
    expect(getStepStates('Create Scratch Org', options)).toBe('skipped');
    expect(getStepStates('Generate Password', options)).toBe('skipped');
    expect(getStepStates('Retrieve Org Details', options)).toBe('skipped');
    expect(getStepStates('Prepare Existing Org', options)).toBe('active');
  });
});
