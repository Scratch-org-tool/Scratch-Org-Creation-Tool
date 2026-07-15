import { describe, expect, it, vi } from 'vitest';
import type { AtlassianConnectionStore } from '../atlassian/atlassian-connection.store';
import type { JiraConnectionConfig, StoredAtlassianConnection } from '../atlassian/atlassian.types';
import { JiraWorkItemAdapter } from './jira.adapter';

function connection(): StoredAtlassianConnection<JiraConnectionConfig> {
  return {
    id: 'jira-connection',
    externalAccountId: 'cloud-1',
    displayName: 'Acme Jira',
    namespace: 'https://acme.atlassian.test',
    credential: { authType: 'oauth2', accessToken: 'jira-oauth-secret' },
    config: {
      deployment: 'cloud',
      cloudId: 'cloud-1',
      siteUrl: 'https://acme.atlassian.test',
      apiGatewayBaseUrl: 'https://api.atlassian.test',
      authBaseUrl: 'https://auth.atlassian.test',
      fieldMappings: {
        severity: 'customfield_10001',
        iteration: 'customfield_10002',
        priority: { Highest: 1 },
      },
    },
    connectedAt: '2026-01-01T00:00:00.000Z',
    lastVerifiedAt: null,
  };
}

function issue() {
  return {
    id: '10001',
    key: 'ABC-1',
    fields: {
      summary: 'Broken deployment',
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Steps here' }] }],
      },
      issuetype: { id: '1', name: 'Bug' },
      status: {
        id: '3',
        name: 'In Progress',
        statusCategory: { key: 'indeterminate', colorName: 'yellow' },
      },
      priority: { id: '9', name: 'Highest' },
      assignee: { accountId: 'acct-7', displayName: 'Ada' },
      reporter: { accountId: 'acct-8', displayName: 'Grace' },
      labels: ['release'],
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-02T00:00:00.000Z',
      components: [{ name: 'Platform' }],
      customfield_10001: { value: 'Critical' },
      customfield_10002: [{ name: 'Sprint 12' }],
      attachment: [{
        id: 'att-1',
        filename: 'failure.log',
        size: 12,
        mimeType: 'text/plain',
      }],
    },
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function store(stored = connection()): AtlassianConnectionStore {
  return {
    getJira: vi.fn().mockResolvedValue(stored),
    getJiraBindingMetadata: vi.fn().mockResolvedValue({
      fieldMappings: { area: 'customfield_10003' },
      workflowMappings: { resolved: 'Done' },
    }),
  } as unknown as AtlassianConnectionStore;
}

describe('JiraWorkItemAdapter', () => {
  it('implements OAuth 2.0 3LO site discovery and verifies the Atlassian accountId', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer jira-oauth-secret' });
      if (url.endsWith('/oauth/token/accessible-resources')) {
        return json([{ id: 'cloud-1', name: 'Acme Jira', url: 'https://acme.atlassian.test' }]);
      }
      if (url.endsWith('/myself')) {
        return json({ accountId: 'atlassian-account-1', displayName: 'Ada' });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const stored = connection();
    const adapter = new JiraWorkItemAdapter(store(stored), fetch);

    await expect(adapter.verifyConnection(stored.credential, stored.config)).resolves.toEqual({
      site: expect.objectContaining({ id: 'cloud-1' }),
      user: expect.objectContaining({ accountId: 'atlassian-account-1' }),
    });
  });

  it('paginates projects and JQL search while mapping Jira fields canonically', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.includes('project/search?startAt=0')) {
        return json({
          values: [{ id: '10', key: 'ABC', name: 'Alpha' }],
          total: 2,
          isLast: false,
        });
      }
      if (url.includes('project/search?startAt=1')) {
        return json({
          values: [{ id: '20', key: 'XYZ', name: 'Xray' }],
          total: 2,
          isLast: true,
        });
      }
      if (url.endsWith('/search/jql')) return json({ issues: [issue()], isLast: true });
      throw new Error(`Unexpected URL ${url}`);
    });
    const adapter = new JiraWorkItemAdapter(store(), fetch);

    await expect(adapter.listProjects()).resolves.toEqual([
      expect.objectContaining({ id: '10', key: 'ABC' }),
      expect.objectContaining({ id: '20', key: 'XYZ' }),
    ]);
    const items = await adapter.queryWorkItems({
      project: 'ABC',
      assigneeId: 'acct-7',
      types: ['Bug'],
      text: 'deploy "failure"',
    });
    expect(items[0]).toMatchObject({
      id: 'ABC-1',
      provider: 'jira',
      priority: 1,
      assignee: { id: 'acct-7', email: null },
      state: { category: 'in_progress' },
    });
    const search = requests.find((request) => request.url.endsWith('/search/jql'));
    const body = JSON.parse(String(search?.init?.body)) as { jql: string };
    expect(body.jql).toContain('project = "ABC"');
    expect(body.jql).toContain('assignee = "acct-7"');
    expect(body.jql).toContain('text ~ "deploy \\"failure\\""');
  });

  it('maps detail fields, comments, history, transitions, users, and attachments', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/issue/ABC-1?fields=') && !url.endsWith('fields=attachment')) {
        return json(issue());
      }
      if (url.endsWith('/issue/ABC-1/comment?startAt=0&maxResults=100')) {
        return json({
          comments: [{
            id: 'comment-1',
            body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fixed' }] }] },
            author: { accountId: 'acct-8', displayName: 'Grace' },
            created: '2026-01-03T00:00:00.000Z',
          }],
          total: 1,
        });
      }
      if (url.endsWith('/issue/ABC-1/changelog?startAt=0&maxResults=100')) {
        return json({
          values: [{
            id: 'history-1',
            created: '2026-01-03T00:00:00.000Z',
            author: { accountId: 'acct-8', displayName: 'Grace' },
            items: [{ field: 'status', fieldId: 'status', fromString: 'Open', toString: 'Done' }],
          }],
          total: 1,
        });
      }
      if (url.endsWith('/issue/ABC-1/transitions?expand=transitions.fields')) {
        return json({
          transitions: [{
            id: '31',
            name: 'Done',
            to: { id: '100', name: 'Done', statusCategory: { key: 'done' } },
          }],
        });
      }
      if (url.includes('/user/assignable/search?')) {
        return json([{ accountId: 'acct-7', displayName: 'Ada', emailAddress: 'hidden@example.test' }]);
      }
      if (url.endsWith('/issue/ABC-1?fields=attachment')) return json(issue());
      if (url.includes('/attachment/content/att-1')) {
        return new Response('failure log', { headers: { 'Content-Type': 'text/plain' } });
      }
      if (init?.method === 'POST' && url.endsWith('/issue/ABC-1/comment')) {
        return json({
          id: 'comment-2',
          body: JSON.parse(String(init.body)).body,
          author: { accountId: 'acct-7', displayName: 'Ada' },
          created: '2026-01-04T00:00:00.000Z',
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const adapter = new JiraWorkItemAdapter(store(), fetch);

    await expect(adapter.getWorkItem('ABC-1', 'ABC')).resolves.toMatchObject({
      description: 'Steps here\n',
      severity: 'Critical',
      areaPath: 'Platform',
      iterationPath: 'Sprint 12',
    });
    await expect(adapter.getComments('ABC-1')).resolves.toEqual([
      expect.objectContaining({ id: 'comment-1', body: 'Fixed\n', author: { id: 'acct-8', displayName: 'Grace', email: null, avatarUrl: null } }),
    ]);
    await expect(adapter.getHistory('ABC-1')).resolves.toEqual([
      expect.objectContaining({ id: 'history-1', changes: [expect.objectContaining({ field: 'status' })] }),
    ]);
    await expect(adapter.getStateOptions('ABC-1', 'ABC')).resolves.toEqual([
      expect.objectContaining({ id: '31', name: 'resolved', category: 'closed' }),
    ]);
    await expect(adapter.listUsers('ABC')).resolves.toEqual([
      expect.objectContaining({ id: 'acct-7', displayName: 'Ada' }),
    ]);
    await expect(adapter.listAttachments('ABC-1')).resolves.toEqual([
      expect.objectContaining({ id: 'att-1', name: 'failure.log' }),
    ]);
    await expect(adapter.getAttachmentContent('ABC-1', 'att-1')).resolves.toMatchObject({
      contentType: 'text/plain',
      fileName: 'failure.log',
    });
    await expect(adapter.addComment('ABC-1', 'Ship it')).resolves.toMatchObject({
      id: 'comment-2',
      body: 'Ship it\n',
    });
  });

  it('creates/updates by accountId and executes mapped workflow transitions', async () => {
    const writes: Array<{ url: string; init?: RequestInit }> = [];
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      writes.push({ url, init });
      if (url.endsWith('/issue') && init?.method === 'POST') return json({ id: '10001', key: 'ABC-1' });
      if (url.endsWith('/issue/ABC-1/transitions') && init?.method !== 'POST') {
        return json({ transitions: [{ id: '31', name: 'Done', to: { name: 'Done' } }] });
      }
      if (url.endsWith('/issue/ABC-1/transitions') && init?.method === 'POST') return json(undefined, 204);
      if (url.includes('/issue/ABC-1?fields=')) return json(issue());
      if (url.endsWith('/issue/ABC-1') && init?.method === 'PUT') return json(undefined, 204);
      throw new Error(`Unexpected URL ${url}`);
    });
    const adapter = new JiraWorkItemAdapter(store(), fetch);

    await adapter.createWorkItem({
      project: 'ABC',
      title: 'Broken deployment',
      type: 'Bug',
      assigneeId: 'acct-7',
      severity: 'Critical',
      priority: 'Highest',
      state: 'resolved',
    });
    const create = writes.find((write) => write.url.endsWith('/issue') && write.init?.method === 'POST');
    expect(JSON.parse(String(create?.init?.body))).toMatchObject({
      fields: {
        project: { key: 'ABC' },
        assignee: { accountId: 'acct-7' },
        customfield_10001: 'Critical',
        priority: { id: '1' },
      },
    });
    const transition = writes.find(
      (write) => write.url.endsWith('/transitions') && write.init?.method === 'POST',
    );
    expect(JSON.parse(String(transition?.init?.body))).toEqual({ transition: { id: '31' } });

    await adapter.updateWorkItem('ABC-1', {
      project: 'ABC',
      assigneeId: null,
      title: 'Updated',
    });
    const update = writes.find((write) => write.url.endsWith('/issue/ABC-1') && write.init?.method === 'PUT');
    expect(JSON.parse(String(update?.init?.body))).toMatchObject({
      fields: { summary: 'Updated', assignee: null },
    });
  });

  it('refreshes and persists expired Jira 3LO tokens', async () => {
    const stored = connection();
    stored.credential = {
      authType: 'oauth2',
      accessToken: 'expired',
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      expiresAt: '2020-01-01T00:00:00.000Z',
    };
    const storeMock = {
      getJira: vi.fn().mockResolvedValue(stored),
      updateJiraCredential: vi.fn().mockResolvedValue(undefined),
    };
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/oauth/token')) {
        return json({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 });
      }
      if (url.includes('/project/search?')) return json({ values: [], total: 0, isLast: true });
      throw new Error(`Unexpected URL ${url}`);
    });
    const adapter = new JiraWorkItemAdapter(
      storeMock as unknown as AtlassianConnectionStore,
      fetch,
    );

    await expect(adapter.listProjects()).resolves.toEqual([]);
    expect(storeMock.updateJiraCredential).toHaveBeenCalledWith(
      stored.id,
      expect.objectContaining({ accessToken: 'new-token', refreshToken: 'new-refresh' }),
      stored.config,
    );
  });
});
