import { describe, expect, it } from 'vitest';
import {
  buildExistingScratchOrgCandidates,
  isActiveRecentRun,
  isCandidateSelectable,
  modeAliasState,
  packageEligibilitySummary,
  resolvePreparationProgress,
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

  it('matches a legacy run through its normalized target id without checkpoint data', () => {
    const legacyRunDto = {
      id: 'legacy-run',
      status: 'completed',
      targetOrgConnectionId: 'connection-1',
      targetOrgConnection: null,
    };
    const candidates = buildExistingScratchOrgCandidates(
      [{ id: 'scratch-1', alias: 'existing', status: 'Active' }],
      [{
        id: 'connection-1',
        alias: 'existing',
        type: 'scratch',
        status: 'active',
      }],
      [legacyRunDto],
    );

    expect(candidates[0].latestRun).toBe(legacyRunDto);
    expect(legacyRunDto).not.toHaveProperty('checkpoint');
  });

  it('recomputes latest run state from refreshed runs without a stale active badge', () => {
    const scratchOrgs = [{ id: 'scratch-1', alias: 'existing', status: 'Active' }];
    const connections = [{
      id: 'connection-1',
      alias: 'existing',
      type: 'scratch',
      status: 'active',
    }];
    const active = {
      id: 'run-1',
      status: 'running',
      targetOrgConnectionId: 'connection-1',
      createdAt: '2026-07-15T12:00:00.000Z',
    };
    const completed = {
      ...active,
      status: 'completed',
      createdAt: '2026-07-15T12:05:00.000Z',
    };

    const before = buildExistingScratchOrgCandidates(scratchOrgs, connections, [active]);
    const after = buildExistingScratchOrgCandidates(
      scratchOrgs,
      connections,
      [active, completed],
    );

    expect(isActiveRecentRun(before[0].latestRun)).toBe(true);
    expect(after[0].latestRun).toBe(completed);
    expect(isActiveRecentRun(after[0].latestRun)).toBe(false);
  });

  it('keeps awaiting post-deploy runs marked active for target exclusivity', () => {
    expect(isActiveRecentRun({
      id: 'run-awaiting',
      status: 'awaiting_input',
      targetOrgConnectionId: 'connection-1',
    })).toBe(true);
  });

  it('restores the create draft alias instead of reusing the selected existing alias', () => {
    const configure = modeAliasState(
      'create_new',
      'configure_existing',
      'my-create-draft',
      '',
    );
    expect(configure.createDraftAlias).toBe('my-create-draft');

    expect(modeAliasState(
      'configure_existing',
      'create_new',
      'selected-existing-alias',
      configure.createDraftAlias,
    )).toEqual({
      alias: 'my-create-draft',
      createDraftAlias: 'my-create-draft',
    });
  });

  it('shows authentication failure and pauses package preparation when no result exists', () => {
    expect(resolvePreparationProgress({
      id: 'run',
      status: 'paused',
      failedStep: 'prepare_existing_org',
      lastError: 'Scratch org is not authenticated',
      jobs: [{
        id: 'prepare',
        status: 'failed',
        currentStep: 'Preparing',
        type: 'prepare_existing_org',
        logs: [{ line: 'Scratch org is not authenticated' }],
      }],
    })).toEqual({
      authentication: 'Failed',
      requiredPackage: 'Paused',
      error: 'Scratch org is not authenticated',
    });
  });

  it('preserves verified authentication and shows package failure with its error', () => {
    expect(resolvePreparationProgress({
      id: 'run',
      status: 'paused',
      failedStep: 'prepare_existing_org',
      lastError: 'Required package installation failed',
      jobs: [{
        id: 'prepare',
        status: 'failed',
        currentStep: 'Preparing',
        type: 'prepare_existing_org',
        logs: [
          { line: 'Salesforce CLI authentication verified' },
          { line: 'Required package installation failed' },
        ],
      }],
    })).toEqual({
      authentication: 'Verified',
      requiredPackage: 'Failed',
      error: 'Required package installation failed',
    });
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

  it('shows automatic pipeline steps complete while awaiting manual actions', () => {
    const options = {
      run: {
        id: 'run',
        status: 'awaiting_input',
        checkpoint: {
          completedSteps: ['scratch_org_create', 'git_metadata_deploy', 'load_org_config'],
          awaitingUserActions: true,
        },
      },
      skippedSteps: new Set<'installPackages' | 'deployMetadata' | 'assignPermissions'>(),
      sourceControlConnected: true,
      launchMode: 'create_new' as const,
    };

    expect(getStepStates('Create Scratch Org', options)).toBe('done');
    expect(getStepStates('Load Org Config', options)).toBe('done');
  });
});
