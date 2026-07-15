import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WorkItemAdapter,
} from '../../integrations/foundation/adapter.contracts';
import { WorkItemAdapterRegistry } from '../../integrations/foundation/adapter.registry';

const db = vi.hoisted(() => ({
  projectBinding: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  workItemConnection: {
    findFirst: vi.fn(),
  },
  externalIdentityBinding: {
    findFirst: vi.fn(),
  },
  workItemSnapshot: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
  },
}));
const getAppUser = vi.hoisted(() => vi.fn());

vi.mock('@sfcc/db', () => ({ prisma: db }));
vi.mock('../auth/app-user.service', () => ({ getAppUser }));

import { DefectsService } from './defects.service';

const capabilities = {
  read: true,
  write: true,
  create: true,
  update: true,
  comments: true,
  webhooks: true,
  attachments: true,
  attachmentUploads: true,
  history: true,
  stateTransitions: true,
  issueTypes: true,
  users: true,
  labels: true,
  subIssues: true,
};

function item(
  provider: 'azure_boards' | 'github_issues' | 'jira',
  id: string,
  assigneeId: string,
) {
  return {
    id,
    provider,
    project: { id: 'project-id', key: 'PROJ', name: 'Project', description: null, url: null },
    title: `Issue ${id}`,
    type: 'Bug',
    state: { id: 'open', name: 'Open', category: 'new' as const, color: null },
    priority: 1,
    assignee: {
      id: assigneeId,
      displayName: assigneeId,
      email: provider === 'azure_boards' ? assigneeId : null,
      avatarUrl: null,
    },
    author: null,
    labels: ['backend'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    url: `https://provider.test/${encodeURIComponent(id)}`,
    description: 'Description',
    acceptanceCriteria: null,
    reproSteps: null,
    severity: null,
    areaPath: null,
    iterationPath: null,
    relations: [],
    customFields: {},
  };
}

function adapter(provider: 'azure_boards' | 'github_issues' | 'jira'): WorkItemAdapter {
  return {
    provider,
    capabilities,
    getConnectionStatus: vi.fn().mockResolvedValue({
      provider,
      state: 'connected',
      connected: true,
      source: 'database',
      displayName: provider,
      namespace: 'organization',
      error: null,
      capabilities,
    }),
    listProjects: vi.fn().mockResolvedValue([]),
    queryWorkItems: vi.fn().mockResolvedValue([]),
    getWorkItem: vi.fn(),
    getComments: vi.fn().mockResolvedValue([]),
    getStateOptions: vi.fn().mockResolvedValue([]),
    getHistory: vi.fn().mockResolvedValue([]),
    listAttachments: vi.fn().mockResolvedValue([]),
    getAttachmentContent: vi.fn(),
    createWorkItem: vi.fn(),
    updateWorkItem: vi.fn(),
    addComment: vi.fn(),
    updateState: vi.fn(),
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    listIssueTypes: vi.fn().mockResolvedValue(['Bug']),
    listUsers: vi.fn().mockResolvedValue([]),
    listSubIssues: vi.fn().mockResolvedValue([]),
    addSubIssue: vi.fn(),
  };
}

describe('DefectsService provider authorization', () => {
  let azure: WorkItemAdapter;
  let github: WorkItemAdapter;
  let jira: WorkItemAdapter;
  let service: DefectsService;

  beforeEach(() => {
    vi.clearAllMocks();
    getAppUser.mockResolvedValue({
      id: 'app-user',
      email: 'developer@example.test',
      role: 'user',
      grantedModules: ['defects'],
    });
    db.projectBinding.findUnique.mockResolvedValue(null);
    db.projectBinding.findFirst.mockResolvedValue(null);
    db.workItemConnection.findFirst.mockImplementation(({ where }: { where: { provider: string } }) =>
      Promise.resolve({ id: `${where.provider}-connection` }));
    db.externalIdentityBinding.findFirst.mockResolvedValue({
      externalUserId: 'provider-user-1',
      externalLogin: 'provider-login',
      externalEmail: 'developer@example.test',
    });
    db.workItemSnapshot.upsert.mockResolvedValue({});
    db.workItemSnapshot.findFirst.mockResolvedValue(null);
    azure = adapter('azure_boards');
    github = adapter('github_issues');
    jira = adapter('jira');
    service = new DefectsService(
      new WorkItemAdapterRegistry([azure, github, jira]),
      { run: vi.fn() } as never,
    );
  });

  it.each([
    ['github_issues', 'owner/repo#91'],
    ['jira', 'CORE-91'],
  ] as const)('uses bound immutable identities and opaque ids for %s', async (provider, id) => {
    const selected = provider === 'jira' ? jira : github;
    vi.mocked(selected.getWorkItem).mockResolvedValue(item(provider, id, 'provider-user-1'));

    const result = await service.getWorkItem('app-user', false, id, {
      provider,
      project: provider === 'jira' ? 'CORE' : 'owner/repo',
    });

    expect(result).toMatchObject({
      id,
      provider,
      externalUrl: expect.stringContaining('provider.test'),
      capabilities,
    });
    expect(selected.getWorkItem).toHaveBeenCalledWith(
      id,
      expect.any(String),
      { connectionId: `${provider}-connection` },
    );
    expect(db.externalIdentityBinding.findFirst).toHaveBeenCalledWith({
      where: {
        workItemConnectionId: `${provider}-connection`,
        appUserId: 'app-user',
      },
      select: { externalUserId: true, externalLogin: true, externalEmail: true },
    });
  });

  it('denies an unbound non-admin before reading a GitHub resource', async () => {
    db.externalIdentityBinding.findFirst.mockResolvedValue(null);

    await expect(service.getWorkItem('app-user', false, 'owner/repo#7', {
      provider: 'github_issues',
      project: 'owner/repo',
    })).rejects.toMatchObject({
      response: { code: 'EXTERNAL_IDENTITY_NOT_BOUND' },
    });
    expect(github.getWorkItem).not.toHaveBeenCalled();
  });

  it('does not authorize Jira by matching an email when provider identity differs', async () => {
    vi.mocked(jira.getWorkItem).mockResolvedValue({
      ...item('jira', 'CORE-7', 'different-account-id'),
      assignee: {
        id: 'different-account-id',
        displayName: 'developer@example.test',
        email: 'developer@example.test',
        avatarUrl: null,
      },
    });

    await expect(service.getComments('app-user', false, 'CORE-7', {
      provider: 'jira',
      project: 'CORE',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(jira.getComments).not.toHaveBeenCalled();
  });

  it('authorizes every attachment download through detail and ownership checks', async () => {
    vi.mocked(jira.getWorkItem).mockResolvedValue(item('jira', 'CORE-8', 'provider-user-1'));
    vi.mocked(jira.listAttachments).mockResolvedValue([{
      id: 'allowed',
      name: 'proof.txt',
      sizeBytes: 4,
      url: 'https://provider.test/attachment',
      contentType: 'text/plain',
      createdAt: null,
      author: null,
    }]);

    await expect(service.getAttachmentContent(
      'app-user',
      false,
      'CORE-8',
      'other',
      { provider: 'jira', project: 'CORE' },
    )).rejects.toThrow('Attachment does not belong');
    expect(jira.getAttachmentContent).not.toHaveBeenCalled();
  });

  it('passes multipart bytes through without JSON/base64 expansion and authorizes deletion', async () => {
    vi.mocked(github.getWorkItem).mockResolvedValue(
      item('github_issues', 'acme/repo#8', 'provider-user-1'),
    );
    vi.mocked(github.uploadAttachment!).mockResolvedValue({
      id: 'attachment-1',
      name: 'proof.txt',
      sizeBytes: 5,
      url: '',
      contentType: 'text/plain',
      createdAt: null,
      author: null,
    });
    const buffer = Buffer.from('proof');
    await service.uploadAttachment(
      'app-user',
      false,
      'acme/repo#8',
      { fileName: 'proof.txt', contentType: 'text/plain', buffer },
      { provider: 'github_issues', project: 'acme/repo' },
    );
    expect(github.uploadAttachment).toHaveBeenCalledWith(
      'acme/repo#8',
      { fileName: 'proof.txt', contentType: 'text/plain', buffer },
      'acme/repo',
      { connectionId: 'github_issues-connection', actorId: 'app-user', isAdmin: undefined },
    );
    await service.deleteAttachment(
      'app-user',
      true,
      'acme/repo#8',
      'attachment-1',
      { provider: 'github_issues', project: 'acme/repo' },
    );
    expect(github.deleteAttachment).toHaveBeenCalledWith(
      'acme/repo#8',
      'attachment-1',
      'acme/repo',
      { connectionId: 'github_issues-connection', actorId: 'app-user', isAdmin: true },
    );
  });

  it('preserves the legacy Azure list shape and assignment behavior', async () => {
    vi.mocked(azure.queryWorkItems).mockResolvedValue([
      item('azure_boards', '42', 'developer@example.test'),
    ]);

    const result = await service.listWorkItems('app-user', false, { project: 'Core' });

    expect(result.items[0]).toMatchObject({
      id: 42,
      state: 'Open',
      assignedTo: expect.stringContaining('developer@example.test'),
      webUrl: expect.stringContaining('/42'),
    });
    expect(azure.queryWorkItems).toHaveBeenCalledWith(expect.objectContaining({
      assigneeEmail: 'developer@example.test',
    }));
  });

  it('passes the selected ProjectBinding connection to the adapter and snapshot cache', async () => {
    db.projectBinding.findUnique.mockResolvedValue({
      id: 'binding-1',
      externalProjectId: '10001',
      projectKey: 'CORE',
      workItemConnectionId: 'jira-special',
      workItemConnection: { provider: 'jira' },
    });
    vi.mocked(jira.getWorkItem).mockResolvedValue(item('jira', 'CORE-12', 'provider-user-1'));

    await service.getWorkItem('app-user', false, 'CORE-12', {
      provider: 'jira',
      bindingId: 'binding-1',
    });

    expect(jira.getWorkItem).toHaveBeenCalledWith(
      'CORE-12',
      'CORE',
      { connectionId: 'jira-special' },
    );
    expect(db.workItemSnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workItemConnectionId_externalProjectId_externalItemId: {
          workItemConnectionId: 'jira-special',
          externalProjectId: 'project-id',
          externalItemId: 'CORE-12',
        },
      },
    }));
  });

  it('uses a GitHub immutable id for authorization and its login for API operations', async () => {
    db.externalIdentityBinding.findFirst.mockResolvedValue({
      externalUserId: '42',
      externalLogin: 'octocat',
      externalEmail: 'ignored@example.test',
    });
    vi.mocked(github.queryWorkItems).mockResolvedValue([
      {
        ...item('github_issues', 'acme/repo#1', '42'),
        assignee: {
          id: '42',
          displayName: 'octocat',
          email: null,
          avatarUrl: null,
        },
      },
    ]);

    await service.listWorkItems('app-user', false, {
      provider: 'github_issues',
      connectionId: 'github-connection',
      project: 'acme/repo',
    });

    expect(github.queryWorkItems).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'github-connection',
      assigneeId: '42',
      assigneeLogin: 'octocat',
      assigneeEmail: undefined,
    }));
  });

  it('rejects binding connection and project mismatches before provider access', async () => {
    db.projectBinding.findUnique.mockResolvedValue({
      id: 'binding-1',
      externalProjectId: '10001',
      projectKey: 'CORE',
      workItemConnectionId: 'jira-special',
      workItemConnection: { provider: 'jira' },
    });

    await expect(service.getWorkItem('app-user', true, 'CORE-1', {
      provider: 'jira',
      bindingId: 'binding-1',
      connectionId: 'jira-other',
    })).rejects.toThrow('connectionId does not match');
    await expect(service.getWorkItem('app-user', true, 'CORE-1', {
      provider: 'jira',
      bindingId: 'binding-1',
      project: 'OTHER',
    })).rejects.toThrow('project does not match');
    expect(jira.getWorkItem).not.toHaveBeenCalled();
  });

  it('constrains implicit project binding lookup to the selected connection', async () => {
    await service.listWorkItems('app-user', true, {
      provider: 'jira',
      connectionId: 'jira-selected',
      project: 'CORE',
    });

    expect(db.projectBinding.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workItemConnectionId: 'jira-selected',
      }),
    }));
  });
});
