import { describe, expect, it, vi } from 'vitest';
import type { GitHubApiClient } from './github-api.client';
import { DisabledGitHubAttachmentStore } from './github-attachment.store';
import type { GitHubIntegrationService } from './github-integration.service';
import type { GitHubCredentials } from './github.types';
import { GitHubWorkItemAdapter } from './github-work-item.adapter';

const credentials: GitHubCredentials = {
  appId: '1',
  privateKey: 'unused',
  installationId: '2',
  baseUrl: 'https://github.com',
};

function issue(number: number, assigneeId: number, login: string) {
  return {
    id: 1000 + number,
    node_id: `I_${number}`,
    number,
    title: `Issue ${number}`,
    body: 'Description',
    state: 'open',
    html_url: `https://github.com/acme/repo/issues/${number}`,
    user: { id: 1, login: 'author' },
    assignee: { id: assigneeId, login },
    labels: [{ name: 'bug' }],
    type: { name: 'Bug' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  };
}

describe('GitHubWorkItemAdapter', () => {
  it('maps configured Projects v2 fields to canonical detail fields', async () => {
    const integration = {
      getWorkItemCredentials: vi.fn().mockResolvedValue(credentials),
      listProjectBindings: vi.fn().mockResolvedValue([
        {
          projectId: 'PVT_1',
          owner: 'acme',
          repository: 'repo',
          fieldMapping: {
            Status: 'FIELD_STATUS',
            Severity: 'FIELD_SEVERITY',
            Priority: 'FIELD_PRIORITY',
            Area: 'FIELD_AREA',
            Iteration: 'FIELD_ITERATION',
          },
        },
      ]),
    } as unknown as GitHubIntegrationService;
    const api = {
      request: vi.fn().mockResolvedValue(issue(7, 42, 'octocat')),
      graphql: vi.fn().mockResolvedValue({
        node: {
          items: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                id: 'PVTI_1',
                content: {
                  ...issue(7, 42, 'octocat'),
                  id: 'I_7',
                  databaseId: 1007,
                  url: 'https://github.com/acme/repo/issues/7',
                  state: 'OPEN',
                  createdAt: '2026-01-01T00:00:00Z',
                  updatedAt: '2026-01-02T00:00:00Z',
                  author: { login: 'author', databaseId: 1 },
                  assignees: {
                    nodes: [{ login: 'octocat', databaseId: 42 }],
                  },
                  labels: { nodes: [{ name: 'bug' }] },
                  issueType: { name: 'Bug' },
                  repository: { nameWithOwner: 'acme/repo' },
                },
                fieldValues: {
                  nodes: [
                    { name: 'In Progress', optionId: 'OPT_1', field: { id: 'FIELD_STATUS', name: 'Workflow' } },
                    { name: 'Critical', field: { id: 'FIELD_SEVERITY', name: 'Impact' } },
                    { number: 1, field: { id: 'FIELD_PRIORITY', name: 'Rank' } },
                    { text: 'Platform', field: { id: 'FIELD_AREA', name: 'Team' } },
                    { title: 'Sprint 12', field: { id: 'FIELD_ITERATION', name: 'Sprint' } },
                  ],
                },
              },
            ],
          },
        },
      }),
    } as unknown as GitHubApiClient;
    const adapter = new GitHubWorkItemAdapter(
      integration,
      api,
      new DisabledGitHubAttachmentStore(),
    );
    const detail = await adapter.getWorkItem('acme/repo#7');
    expect(detail).toMatchObject({
      id: 'acme/repo#7',
      state: { name: 'In Progress', category: 'in_progress' },
      priority: 1,
      severity: 'Critical',
      areaPath: 'Platform',
      iterationPath: 'Sprint 12',
      assignee: { id: '42', displayName: 'octocat', email: null },
    });
  });

  it('matches assignees only by exact GitHub id/login, never email substring', async () => {
    const integration = {
      getWorkItemCredentials: vi.fn().mockResolvedValue(credentials),
      listProjectBindings: vi.fn().mockResolvedValue([]),
    } as unknown as GitHubIntegrationService;
    const api = {
      paginate: vi.fn().mockResolvedValue([
        issue(1, 42, 'ada'),
        issue(2, 142, 'ada-company'),
      ]),
    } as unknown as GitHubApiClient;
    const adapter = new GitHubWorkItemAdapter(
      integration,
      api,
      new DisabledGitHubAttachmentStore(),
    );
    const byId = await adapter.queryWorkItems({ project: 'acme/repo', assigneeId: '42' });
    expect(byId.map((item) => item.id)).toEqual(['acme/repo#1']);
    const byLogin = await adapter.queryWorkItems({
      project: 'acme/repo',
      assigneeLogin: 'ada',
    });
    expect(byLogin.map((item) => item.id)).toEqual(['acme/repo#1']);
    expect(byLogin[0].assignee?.email).toBeNull();
  });

  it('clearly advertises unavailable attachment storage', async () => {
    const integration = {
      getWorkItemConnection: vi.fn().mockResolvedValue({
        id: 'w1',
        status: 'connected',
        displayName: 'acme',
        namespace: 'acme',
        createdAt: new Date(),
        lastVerifiedAt: null,
      }),
    } as unknown as GitHubIntegrationService;
    const adapter = new GitHubWorkItemAdapter(
      integration,
      {} as GitHubApiClient,
      new DisabledGitHubAttachmentStore(),
    );
    await expect(adapter.getConnectionStatus()).resolves.toMatchObject({
      capabilities: { attachments: false },
    });
    await expect(adapter.listAttachments('acme/repo#1')).resolves.toEqual([]);
  });
});
