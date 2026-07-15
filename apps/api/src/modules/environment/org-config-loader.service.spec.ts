import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgConnection: { findUnique: vi.fn() },
}));
const sfCli = vi.hoisted(() => ({
  query: vi.fn(),
  getOrgDisplay: vi.fn(),
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));
vi.mock('@sfcc/sf-cli', () => ({ createSfCliClient: () => sfCli }));

import { ONBOARDING_CONFIG_OBJECT } from '@sfcc/shared';
import { OrgConfigLoaderService } from './org-config-loader.service';

describe('OrgConfigLoaderService selectors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique.mockResolvedValue({
      alias: 'scratch',
      username: null,
      instanceUrl: 'https://example.my.salesforce.com',
    });
    sfCli.getOrgDisplay.mockResolvedValue({
      data: { result: { instanceUrl: 'https://example.my.salesforce.com' } },
    });
    sfCli.createRecord.mockResolvedValue({
      success: true,
      data: { result: { id: 'config-id' } },
    });
    sfCli.updateRecord.mockResolvedValue({ success: true });
    sfCli.deleteRecord.mockResolvedValue({ success: true });
  });

  it('includes bottler and config key when creating, then finds the same record', async () => {
    let selectorQueries = 0;
    sfCli.query.mockImplementation(async (_alias: string, soql: string) => {
      if (soql.includes('StaticResource')) {
        return { success: true, data: { result: { records: [] } } };
      }
      selectorQueries += 1;
      return {
        success: true,
        data: { result: { records: selectorQueries === 1 ? [] : [{ Id: 'config-id' }] } },
      };
    });
    const loader = new OrgConfigLoaderService();
    const options = {
      upsertQueueIds: false,
      upsertDomainFields: true,
      upsertRequestId: false,
      bottler: '5000',
      configKey: 'Primary Config',
    };

    await loader.loadForOrg('org', options);
    await loader.loadForOrg('org', options);

    expect(sfCli.createRecord).toHaveBeenCalledWith(
      'scratch',
      ONBOARDING_CONFIG_OBJECT,
      expect.objectContaining({
        cfs_ob__Bottler__c: '5000',
        Name: 'Primary Config',
      }),
    );
    expect(sfCli.createRecord).toHaveBeenCalledTimes(1);
    expect(sfCli.updateRecord).toHaveBeenCalledWith(
      'scratch',
      ONBOARDING_CONFIG_OBJECT,
      'config-id',
      expect.any(Object),
    );
    const selectorSoql = sfCli.query.mock.calls
      .map((call) => call[1] as string)
      .filter((soql) => soql.includes(`FROM ${ONBOARDING_CONFIG_OBJECT}`));
    expect(selectorSoql).toHaveLength(2);
    expect(selectorSoql[0]).toContain("cfs_ob__Bottler__c = '5000'");
    expect(selectorSoql[0]).toContain("Name = 'Primary Config'");
  });

  it('throws on a failed config query instead of creating a duplicate', async () => {
    sfCli.query.mockImplementation(async (_alias: string, soql: string) => {
      if (soql.includes('StaticResource')) {
        return { success: true, data: { result: { records: [] } } };
      }
      return {
        success: false,
        error: 'target org unavailable',
      };
    });

    await expect(new OrgConfigLoaderService().loadForOrg('org', {
      upsertQueueIds: false,
      upsertDomainFields: true,
      upsertRequestId: false,
    })).rejects.toThrow('target org unavailable');
    expect(sfCli.createRecord).not.toHaveBeenCalled();
  });

  it('surfaces temporary Request creation failures without attempting cleanup', async () => {
    sfCli.createRecord.mockResolvedValueOnce({
      success: false,
      error: 'request create failed',
    });

    await expect(new OrgConfigLoaderService().loadForOrg('org', {
      upsertQueueIds: false,
      upsertDomainFields: false,
      upsertRequestId: true,
    })).rejects.toThrow('request create failed');
    expect(sfCli.deleteRecord).not.toHaveBeenCalled();
  });

  it('surfaces temporary Request cleanup failures before changing org config', async () => {
    sfCli.createRecord.mockResolvedValueOnce({
      success: true,
      data: { result: { id: 'a01000000000001AAA' } },
    });
    sfCli.deleteRecord.mockResolvedValueOnce({
      success: false,
      error: 'request delete failed',
    });

    await expect(new OrgConfigLoaderService().loadForOrg('org', {
      upsertQueueIds: false,
      upsertDomainFields: false,
      upsertRequestId: true,
    })).rejects.toThrow('request delete failed');
    expect(sfCli.query).not.toHaveBeenCalled();
    expect(sfCli.updateRecord).not.toHaveBeenCalled();
  });
});
