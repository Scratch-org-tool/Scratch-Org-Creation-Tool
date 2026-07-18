import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCRATCH_PERMISSION_SET } from '@sfcc/shared';

const db = vi.hoisted(() => ({
  job: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));
const sf = vi.hoisted(() => ({
  assignPermissionSet: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));
vi.mock('@sfcc/sf-cli', () => ({
  createSfCliClient: vi.fn(() => sf),
}));

import { MetadataDeployWorker, PipelineStepError } from './metadata-deploy.worker';

function createWorker() {
  return new MetadataDeployWorker(
    { addLog: vi.fn().mockResolvedValue({}) } as never,
    {
      publishJobLog: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
    } as never,
    {} as never,
    {
      isCancellationRequested: vi.fn().mockResolvedValue(false),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function assignmentJob(permissionSets: string[]) {
  return {
    data: {
      orgAlias: 'scratch@example.com',
      dbJobId: 'job-1',
      automationRunId: 'run-1',
      assignPermissionSetOnly: true,
      permissionSets,
    },
  } as never;
}

describe('MetadataDeployWorker permission-set assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.job.findUnique.mockResolvedValue({ status: 'running' });
    db.job.update.mockResolvedValue({});
    sf.assignPermissionSet.mockResolvedValue({ success: true });
  });

  it('assigns the base and template permission sets once in deterministic order', async () => {
    const result = await createWorker().process(assignmentJob([
      ' Onboarding_Admin_Extension ',
      SCRATCH_PERMISSION_SET,
      'Onboarding_Admin_Extension',
      'Lifecycle_Super_User',
    ]));

    expect(sf.assignPermissionSet.mock.calls.map((call) => call[1])).toEqual([
      SCRATCH_PERMISSION_SET,
      'Onboarding_Admin_Extension',
      'Lifecycle_Super_User',
    ]);
    expect(result).toEqual({
      assignPermissionSetCompleted: true,
      assignedPermissionSets: [
        SCRATCH_PERMISSION_SET,
        'Onboarding_Admin_Extension',
        'Lifecycle_Super_User',
      ],
    });
  });

  it('stops at the first failed template permission set with the pipeline step attached', async () => {
    sf.assignPermissionSet
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'Permission set does not exist' });

    const error = await createWorker()
      .process(assignmentJob(['Missing_Permission_Set', 'Never_Attempted']))
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(PipelineStepError);
    expect(error).toMatchObject({ pipelineStep: 'assign_permission_set' });
    expect(sf.assignPermissionSet.mock.calls.map((call) => call[1])).toEqual([
      SCRATCH_PERMISSION_SET,
      'Missing_Permission_Set',
    ]);
  });
});
