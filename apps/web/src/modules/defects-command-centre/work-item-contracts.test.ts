import { describe, expect, it } from 'vitest';
import {
  contextParams,
  defectsCacheKey,
  isWorkItemProvider,
  parseCsv,
  projectValue,
  providerEndpoint,
  providerProjectUrl,
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
});
