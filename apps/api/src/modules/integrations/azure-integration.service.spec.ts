import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  azureDevOpsConnection: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  scmConnection: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  workItemConnection: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));
vi.mock('../../common/crypto.util', () => ({
  decrypt: vi.fn((value: string) => `plain:${value}`),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}));

import {
  AZURE_ENV_SCM_CONNECTION_ID,
  AzureIntegrationService,
} from './azure-integration.service';

describe('AzureIntegrationService connection selection', () => {
  const originalEnv = {
    org: process.env.AZURE_DEVOPS_ORG,
    pat: process.env.AZURE_DEVOPS_PAT,
    project: process.env.AZURE_DEFAULT_PROJECT,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AZURE_DEVOPS_ORG;
    delete process.env.AZURE_DEVOPS_PAT;
    delete process.env.AZURE_DEFAULT_PROJECT;
    db.azureDevOpsConnection.findFirst.mockResolvedValue(null);
    db.scmConnection.findFirst.mockResolvedValue(null);
    db.workItemConnection.findFirst.mockResolvedValue(null);
    db.scmConnection.deleteMany.mockResolvedValue({ count: 1 });
    db.workItemConnection.deleteMany.mockResolvedValue({ count: 1 });
    db.azureDevOpsConnection.deleteMany.mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementation(async (value: unknown) =>
      typeof value === 'function'
        ? value(db)
        : Promise.all(value as Promise<unknown>[]));
  });

  afterEach(() => {
    for (const [key, value] of Object.entries({
      AZURE_DEVOPS_ORG: originalEnv.org,
      AZURE_DEVOPS_PAT: originalEnv.pat,
      AZURE_DEFAULT_PROJECT: originalEnv.project,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('resolves credentials from the selected provider-neutral connection', async () => {
    db.workItemConnection.findFirst.mockResolvedValue({
      id: 'wi-second',
      provider: 'azure_boards',
      externalAccountId: 'second-org',
      displayName: 'second-org',
      namespace: 'second-org',
      encryptedCredentials: 'second-pat',
      status: 'connected',
      metadata: { defaultProject: 'Second' },
      legacyAzureDevOpsConnectionId: 'legacy-second',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const service = new AzureIntegrationService();

    await expect(service.getCredentials('wi-second')).resolves.toEqual({
      orgSlug: 'second-org',
      pat: 'plain:second-pat',
      project: 'Second',
    });
    expect(db.workItemConnection.findFirst).toHaveBeenCalledWith({
      where: { id: 'wi-second', provider: 'azure_boards' },
    });
  });

  it('uses the environment sentinel without attempting a database lookup', async () => {
    process.env.AZURE_DEVOPS_ORG = 'env-org';
    process.env.AZURE_DEVOPS_PAT = 'env-pat';
    process.env.AZURE_DEFAULT_PROJECT = 'EnvProject';
    const service = new AzureIntegrationService();

    await expect(service.getCredentials(AZURE_ENV_SCM_CONNECTION_ID)).resolves.toEqual({
      orgSlug: 'env-org',
      pat: 'env-pat',
      project: 'EnvProject',
    });
    expect(db.scmConnection.findFirst).not.toHaveBeenCalled();
    expect(db.workItemConnection.findFirst).not.toHaveBeenCalled();
  });

  it('disconnects only the selected paired Azure connection', async () => {
    db.scmConnection.findFirst.mockResolvedValue({
      id: 'scm-second',
      provider: 'azure_devops',
      externalAccountId: 'second-org',
      displayName: 'second-org',
      namespace: 'second-org',
      encryptedCredentials: 'second-pat',
      status: 'connected',
      metadata: {},
      legacyAzureDevOpsConnectionId: 'legacy-second',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const service = new AzureIntegrationService();

    await expect(service.disconnect('scm-second')).resolves.toMatchObject({
      disconnected: true,
      connectionId: 'scm-second',
      count: 3,
    });
    expect(db.scmConnection.deleteMany).toHaveBeenCalledWith({
      where: {
        provider: 'azure_devops',
        legacyAzureDevOpsConnectionId: 'legacy-second',
      },
    });
    expect(db.workItemConnection.deleteMany).toHaveBeenCalledWith({
      where: {
        provider: 'azure_boards',
        legacyAzureDevOpsConnectionId: 'legacy-second',
      },
    });
    expect(db.azureDevOpsConnection.deleteMany).toHaveBeenCalledWith({
      where: { id: 'legacy-second' },
    });
  });

  it('preserves the legacy no-id disconnect behavior', async () => {
    const service = new AzureIntegrationService();
    await service.disconnect();

    expect(db.azureDevOpsConnection.deleteMany).toHaveBeenCalledWith({});
    expect(db.scmConnection.deleteMany).toHaveBeenCalledWith({
      where: { legacyAzureDevOpsConnectionId: { not: null } },
    });
  });
});
