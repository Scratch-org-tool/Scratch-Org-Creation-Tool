import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgConnection: { findUnique: vi.fn() },
}));
const sfCli = vi.hoisted(() => ({
  query: vi.fn(),
  listSObjects: vi.fn(),
  describeSObject: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));
vi.mock('@sfcc/sf-cli', () => ({ createSfCliClient: () => sfCli }));

import {
  OrgToOrgBrowseService,
  clearOrgToOrgSchemaCache,
} from './org-to-org-browse.service';

const orgId = '00000000-0000-4000-8000-000000000001';

const ACCOUNT_DESCRIBE = {
  data: {
    result: {
      name: 'Account',
      label: 'Account',
      nameField: { name: 'Name' },
      fields: [
        { name: 'Id', type: 'id', filterable: true },
        { name: 'Name', type: 'string', filterable: true, createable: true },
        {
          name: 'External__c',
          type: 'string',
          filterable: true,
          createable: true,
          externalId: true,
        },
      ],
    },
  },
};

describe('OrgToOrgBrowseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOrgToOrgSchemaCache();
    db.orgConnection.findUnique.mockResolvedValue({
      id: orgId,
      alias: 'source',
      username: null,
      createdBy: 'owner',
    });
    sfCli.describeSObject.mockResolvedValue(ACCOUNT_DESCRIBE);
    sfCli.listSObjects.mockResolvedValue({
      success: true,
      data: { result: ['Account', 'Contact'] },
    });
    sfCli.query.mockResolvedValue({
      success: true,
      data: { result: { records: [{ Id: '001000000000001AAA', Name: 'Acme' }], totalSize: 1 } },
    });
  });

  it('adds Id to custom SOQL preview queries that omit it', async () => {
    const service = new OrgToOrgBrowseService();
    await service.previewFilter(
      {
        sourceOrgId: orgId,
        objectName: 'Account',
        recordLimit: 200,
        soql: 'SELECT Name FROM Account',
      },
      'owner',
    );
    const executed = sfCli.query.mock.calls[0]?.[1] as string;
    expect(executed).toMatch(/^SELECT Id, Name FROM Account/i);
  });

  it('keeps ownership checks per request but caches CLI describes', async () => {
    const service = new OrgToOrgBrowseService();
    await service.getObjectMeta(orgId, 'Account', 'owner');
    await service.getObjectMeta(orgId, 'Account', 'owner');
    expect(sfCli.describeSObject).toHaveBeenCalledTimes(1);
    expect(db.orgConnection.findUnique).toHaveBeenCalledTimes(2);
  });

  it('serves repeat object listings from cache and filters searches locally', async () => {
    const service = new OrgToOrgBrowseService();
    const all = await service.listObjects(orgId, 'owner');
    const filtered = await service.listObjects(orgId, 'owner', 'contact');
    expect(sfCli.listSObjects).toHaveBeenCalledTimes(1);
    expect(all.map((o) => o.apiName)).toEqual(['Account', 'Contact']);
    expect(filtered.map((o) => o.apiName)).toEqual(['Contact']);
  });

  it('still rejects previews for orgs the user does not own', async () => {
    db.orgConnection.findUnique.mockResolvedValue({
      id: orgId,
      alias: 'source',
      username: null,
      createdBy: 'someone-else',
    });
    const service = new OrgToOrgBrowseService();
    await expect(
      service.previewFilter(
        {
          sourceOrgId: orgId,
          objectName: 'Account',
          recordLimit: 200,
          soql: 'SELECT Name FROM Account',
        },
        'owner',
      ),
    ).rejects.toThrow(/not found/i);
    expect(sfCli.query).not.toHaveBeenCalled();
  });
});
