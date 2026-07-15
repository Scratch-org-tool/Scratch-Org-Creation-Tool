import { describe, expect, it } from 'vitest';
import {
  contextParams,
  defectsCacheKey,
  isWorkItemProvider,
  parseCsv,
  projectValue,
  providerEndpoint,
  providerProjectUrl,
  selectableWorkItemProjects,
  workItemOperationCapabilities,
  workItemEndpoint,
  type WorkItemContext,
} from './work-item-contracts';

const jira: WorkItemContext = {
  provider: 'jira',
  connectionId: 'connection/one',
  bindingId: 'binding?one',
  project: 'CORE',
};

describe('provider-neutral work-item routing', () => {
  it('preserves opaque IDs by encoding them only at the URL boundary', () => {
    expect(workItemEndpoint(jira, 'CORE/ABC?123', 'comments')).toBe(
      '/defects/providers/jira/work-items/CORE%2FABC%3F123/comments' +
      '?connectionId=connection%2Fone&bindingId=binding%3Fone&project=CORE',
    );
  });

  it('includes provider and binding identity in cache keys', () => {
    expect(defectsCacheKey('overview', jira)).not.toBe(
      defectsCacheKey('overview', { ...jira, provider: 'github_issues' }),
    );
    expect(defectsCacheKey('overview', jira)).not.toBe(
      defectsCacheKey('overview', { ...jira, bindingId: 'other' }),
    );
  });

  it('builds canonical provider paths and context queries', () => {
    expect(providerEndpoint('github_issues', '/work-items')).toBe(
      '/defects/providers/github_issues/work-items',
    );
    expect(contextParams(jira).get('connectionId')).toBe('connection/one');
  });

  it('uses provider-specific project identifiers without numeric coercion', () => {
    const project = { id: 'PVT_kwDOOpaque', key: 'owner/repo' };
    expect(projectValue('github_issues', project)).toBe('PVT_kwDOOpaque');
    expect(projectValue('jira', project)).toBe('owner/repo');
  });

  it('prefers canonical project links and confines the legacy Azure fallback', () => {
    expect(providerProjectUrl('jira', {
      key: 'CORE',
      externalUrl: 'https://jira.example/browse/CORE',
    })).toBe('https://jira.example/browse/CORE');
    expect(providerProjectUrl(
      'azure_boards',
      { key: 'Core Team' },
      'https://dev.azure.example/org/',
    )).toBe('https://dev.azure.example/org/Core%20Team/_boards');
    expect(providerProjectUrl('github_issues', { key: 'owner/repo' }, 'https://example.test')).toBeNull();
  });

  it('validates providers and normalizes comma-separated fields', () => {
    expect(isWorkItemProvider('azure_boards')).toBe(true);
    expect(isWorkItemProvider('azure')).toBe(false);
    expect(parseCsv('api, ui, api,  ')).toEqual(['api', 'ui']);
  });

  it('derives provider-specific operations instead of treating write as universal', () => {
    const capabilities = {
      read: true,
      write: true,
      create: true,
      update: true,
      comments: true,
      webhooks: false,
      attachments: true,
      attachmentUploads: true,
      attachmentDeletes: true,
      history: true,
      stateTransitions: true,
      issueTypes: true,
      users: true,
      labels: true,
      subIssues: true,
    };
    expect(workItemOperationCapabilities('github_issues', capabilities)).toMatchObject({
      create: true,
      edit: true,
      addComments: true,
      uploadAttachments: true,
      deleteAttachments: true,
      readSubissues: true,
      addSubissues: true,
    });
    expect(workItemOperationCapabilities('azure_boards', {
      ...capabilities,
      create: false,
      update: false,
      comments: false,
      attachmentUploads: false,
      attachmentDeletes: true,
      subIssues: false,
    })).toMatchObject({
      create: false,
      edit: false,
      addComments: false,
      uploadAttachments: false,
      deleteAttachments: true,
      readSubissues: false,
      transitionState: true,
    });
  });

  it('hides unbound GitHub Projects v2 while retaining repositories and bindings', () => {
    const projects = [
      { id: 'PVT_unbound', key: 'PVT_unbound', name: 'Unbound', description: null, url: null },
      { id: 'PVT_bound', key: 'PVT_bound', name: 'Bound', description: null, url: null },
      { id: 'acme/repo', key: 'acme/repo', name: 'acme/repo', description: null, url: null },
    ];
    const result = selectableWorkItemProjects('github_issues', projects, [{
      id: 'binding-1',
      connectionId: 'connection-1',
      provider: 'github_issues',
      externalProjectId: 'PVT_bound',
      projectKey: 'acme',
      repositoryName: 'repo',
    }], 'connection-1');
    expect(result.projects.map((project) => project.id)).toEqual(['PVT_bound', 'acme/repo']);
    expect(result.unboundGitHubProjects).toBe(1);
  });
});
