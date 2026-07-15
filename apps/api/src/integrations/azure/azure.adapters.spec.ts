import { describe, expect, it, vi } from 'vitest';
import type { AzureIntegrationService } from '../../modules/integrations/azure-integration.service';
import { AzureScmAdapter, AzureWorkItemAdapter } from './azure.adapters';
import type { AzureService } from './azure.service';
import type { AzureWorkItemsService } from './azure-work-items.service';

describe('AzureScmAdapter compatibility', () => {
  it('normalizes existing service results and never exposes credentials', async () => {
    const azure = {
      listRepos: vi.fn().mockResolvedValue([
        { id: 'r1', name: 'metadata', project: 'Core', url: 'https://dev.azure.test/repo' },
      ]),
      listBranches: vi.fn().mockResolvedValue(['main']),
    } as unknown as AzureService;
    const integration = {
      getStatus: vi.fn().mockResolvedValue({
        connected: true,
        source: 'database',
        orgSlug: 'acme',
        project: 'Core',
        status: 'active',
        connectedAt: '2026-01-01T00:00:00.000Z',
        pat: 'must-not-leak',
      }),
    } as unknown as AzureIntegrationService;
    const adapter = new AzureScmAdapter(azure, integration);

    const status = await adapter.getConnectionStatus();
    expect(status).toMatchObject({
      provider: 'azure_devops',
      connected: true,
      namespace: 'acme',
    });
    expect(status).not.toHaveProperty('pat');

    expect(await adapter.listRepositories({ project: 'Core' })).toEqual([
      {
        id: 'r1',
        name: 'metadata',
        fullName: 'Core/metadata',
        namespace: 'Core',
        defaultBranch: null,
        url: 'https://dev.azure.test/repo',
        isPrivate: true,
      },
    ]);
    expect(await adapter.listBranches({
      provider: 'azure_devops',
      project: 'Core',
      repo: 'metadata',
      branch: 'main',
    })).toEqual(['main']);
    expect(azure.listBranches).toHaveBeenCalledWith('Core', 'metadata', undefined);
  });
});

describe('AzureWorkItemAdapter compatibility', () => {
  it('converts numeric Azure contracts into canonical work-item contracts', async () => {
    const azure = {
      queryWorkItems: vi.fn().mockResolvedValue([{
        id: 42,
        title: 'Fix deploy',
        type: 'Bug',
        state: 'Active',
        priority: 1,
        assignedTo: 'Ada Lovelace <ada@example.test>',
        changedDate: '2026-01-02T00:00:00.000Z',
        createdDate: '2026-01-01T00:00:00.000Z',
        tags: ['release'],
        webUrl: 'https://dev.azure.test/items/42',
        project: 'Core',
      }]),
    } as unknown as AzureWorkItemsService;
    const adapter = new AzureWorkItemAdapter(azure);
    expect(adapter.capabilities).toMatchObject({
      create: true,
      update: true,
      comments: true,
      attachmentUploads: true,
      issueTypes: true,
      users: false,
      labels: false,
      subIssues: false,
    });
    expect(adapter.createWorkItem).toBeTypeOf('function');
    expect(adapter.updateWorkItem).toBeTypeOf('function');
    expect(adapter.addComment).toBeTypeOf('function');
    expect(adapter.uploadAttachment).toBeTypeOf('function');

    const items = await adapter.queryWorkItems({ project: 'Core' });
    expect(items[0]).toMatchObject({
      id: '42',
      provider: 'azure_boards',
      project: { id: 'Core', key: 'Core' },
      state: { name: 'Active', category: 'in_progress' },
      assignee: { displayName: 'Ada Lovelace', email: 'ada@example.test' },
    });
    expect(azure.queryWorkItems).toHaveBeenCalledWith({
      project: 'Core',
      assigneeEmail: undefined,
      types: undefined,
      connectionId: undefined,
    });
  });

  it('keeps numeric URL compatibility while rejecting non-Azure opaque ids at the boundary', async () => {
    const azure = {
      getWorkItem: vi.fn().mockResolvedValue({
        id: 42,
        title: 'Fix deploy',
        type: 'Bug',
        state: 'Active',
        priority: 1,
        assignedTo: null,
        changedDate: '2026-01-02T00:00:00.000Z',
        createdDate: '2026-01-01T00:00:00.000Z',
        tags: [],
        webUrl: 'https://dev.azure.test/items/42',
        project: 'Core',
        description: null,
        reproSteps: null,
        acceptanceCriteria: null,
        areaPath: null,
        iterationPath: null,
        severity: null,
        relations: [],
      }),
    } as unknown as AzureWorkItemsService;
    const adapter = new AzureWorkItemAdapter(azure);

    await expect(adapter.getWorkItem('42', 'Core')).resolves.toMatchObject({ id: '42' });
    expect(azure.getWorkItem).toHaveBeenCalledWith(42, 'Core', undefined);
    await expect(adapter.getWorkItem('CORE-42')).rejects.toThrow(
      'Invalid Azure Boards work item id',
    );
  });

  it('passes selected provider-neutral connection ids to every Azure service call', async () => {
    const azure = {
      getConnectionInfo: vi.fn().mockResolvedValue({
        id: 'wi-2',
        orgSlug: 'second-org',
        defaultProject: 'Second',
        source: 'database',
      }),
      getWorkItem: vi.fn().mockResolvedValue({
        id: 42,
        title: 'Fix deploy',
        type: 'Bug',
        state: 'Active',
        priority: 1,
        assignedTo: null,
        changedDate: '',
        createdDate: '',
        tags: [],
        webUrl: '',
        project: 'Second',
        description: null,
        reproSteps: null,
        acceptanceCriteria: null,
        areaPath: null,
        iterationPath: null,
        severity: null,
        relations: [],
      }),
      getComments: vi.fn().mockResolvedValue([]),
    } as unknown as AzureWorkItemsService;
    const adapter = new AzureWorkItemAdapter(azure);

    await adapter.getConnectionStatus({ connectionId: 'wi-2' });
    await adapter.getWorkItem('42', 'Second', { connectionId: 'wi-2' });
    await adapter.getComments('42', 'Second', { connectionId: 'wi-2' });

    expect(azure.getConnectionInfo).toHaveBeenCalledWith('wi-2');
    expect(azure.getWorkItem).toHaveBeenCalledWith(42, 'Second', 'wi-2');
    expect(azure.getComments).toHaveBeenCalledWith(42, 'Second', 'wi-2');
  });
});
