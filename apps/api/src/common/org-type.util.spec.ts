import { describe, expect, it } from 'vitest';
import { resolveOrgTypeFromInstance } from './org-type.util';

describe('resolveOrgTypeFromInstance', () => {
  it.each([
    'https://test.salesforce.com',
    'https://acme--uat.sandbox.my.salesforce.com',
    'https://acme--uat.sandbox.lightning.force.com',
    'https://cs42.salesforce.com',
  ])('recognizes Salesforce sandbox hosts (%s)', (instanceUrl) => {
    expect(resolveOrgTypeFromInstance(instanceUrl)).toBe('sandbox');
  });

  it('keeps production orgs and Dev Hubs classified as production', () => {
    expect(resolveOrgTypeFromInstance('https://acme.my.salesforce.com')).toBe('prod');
    expect(resolveOrgTypeFromInstance('https://test.salesforce.com', true)).toBe('prod');
  });
});
