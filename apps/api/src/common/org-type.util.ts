export type AuthenticatedOrgType = 'prod' | 'sandbox';

export function isLikelyScratchOrg(connection: {
  instanceUrl?: string | null;
  username?: string | null;
}): boolean {
  const url = connection.instanceUrl?.toLowerCase() ?? '';
  const user = connection.username?.toLowerCase() ?? '';
  return url.includes('.scratch.my.salesforce.com') || user.includes('@scratch');
}

export function resolveOrgTypeFromInstance(
  instanceUrl: string | null | undefined,
  isDevHub = false,
): AuthenticatedOrgType {
  if (isDevHub) return 'prod';
  if (isLikelyScratchOrg({ instanceUrl })) return 'sandbox';
  const url = instanceUrl?.toLowerCase() ?? '';
  if (url.includes('test.salesforce.com')) return 'sandbox';
  return 'prod';
}
