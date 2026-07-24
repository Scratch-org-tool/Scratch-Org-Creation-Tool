import type { SfCliClient } from '@sfcc/sf-cli';

export interface OrgConnectionLike {
  alias: string;
  username?: string | null;
}

export function describeSfCliAccessError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('error_http_420')
    || lower.includes('http response contains html content')
    || lower.includes('http status code: 420')
  ) {
    return 'Salesforce CLI session expired or the scratch org is no longer active. Reconnect the org in Environment Center → Connect Org.';
  }
  if (
    lower.includes('no authorization')
    || lower.includes('not authorized')
    || lower.includes('invalid grant')
    || lower.includes('expired')
    || lower.includes('invalid alias')
    || lower.includes('cannot find org')
    || lower.includes('does not exist')
  ) {
    return 'Salesforce CLI is not logged in to this org. Reconnect it in Environment Center → Connect Org.';
  }
  if (lower.includes('encountered errors loading config')) {
    return 'Salesforce CLI is unavailable on the API server. Verify SF CLI is installed and SF_CLI_PATH is configured.';
  }
  return message;
}

/**
 * Resolve the Salesforce CLI --target-org value and verify the local CLI can
 * reach the org. App authorization (DB status=active) is separate from CLI auth;
 * data jobs always run through sf/data commands on the API host.
 */
export async function resolveSfCliTarget(
  sfCli: Pick<SfCliClient, 'getOrgDisplay'>,
  org: OrgConnectionLike,
  label = 'Org',
): Promise<string> {
  const candidates = [...new Set([org.username, org.alias].filter(Boolean))] as string[];
  if (candidates.length === 0) {
    throw new Error(`${label} is missing a Salesforce CLI alias`);
  }

  let lastError = `${label} is not reachable through Salesforce CLI`;
  for (const candidate of candidates) {
    const display = await sfCli.getOrgDisplay(candidate);
    if (display.success) return candidate;
    lastError = describeSfCliAccessError(
      display.error ?? `Salesforce CLI could not reach "${candidate}"`,
    );
  }

  throw new Error(
    `${label} "${org.alias}" is connected in the app but Salesforce CLI cannot access it. ${lastError}`,
  );
}
