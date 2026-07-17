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
  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // Keep accepting the legacy string values already stored in the database.
  }
  if (
    hostname === 'test.salesforce.com'
    || hostname.endsWith('.sandbox.my.salesforce.com')
    || hostname.endsWith('.sandbox.lightning.force.com')
    || /^cs\d+\./.test(hostname)
  ) {
    return 'sandbox';
  }
  return 'prod';
}
