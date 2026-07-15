export interface GitHubProjectFieldMapping {
  Severity?: string;
  Priority?: string;
  Area?: string;
  Iteration?: string;
  Status?: string;
  [canonicalField: string]: string | undefined;
}

export interface GitHubProjectBindingConfig {
  projectId: string;
  owner: string;
  repository?: string;
  fieldMapping?: GitHubProjectFieldMapping;
}

/** Stored only as encrypted JSON in provider-neutral connection rows. */
export interface GitHubCredentials {
  appId: string;
  privateKey: string;
  installationId: string;
  baseUrl: string;
  pat?: string;
  webhookSecret?: string;
}

export interface GitHubConnectInput {
  appId: string;
  privateKey: string;
  installationId: string;
  baseUrl?: string;
  pat?: string;
  webhookSecret?: string;
  projectBindings?: GitHubProjectBindingConfig[];
}

export interface GitHubIdentity {
  appId: string;
  appSlug: string;
  installationId: string;
  accountId: string;
  accountLogin: string;
  accountType: string;
  baseUrl: string;
}

export interface GitHubToken {
  /** Deliberately opaque: callers must never decode or log this value. */
  token: string;
  expiresAt: Date | null;
  source: 'installation' | 'pat';
}

export interface GitHubProjectBindingRecord {
  projectId: string;
  owner: string;
  repository: string | null;
  fieldMapping: GitHubProjectFieldMapping;
}

export interface GitHubIssueRef {
  owner: string;
  repo: string;
  number: number;
}

export function normalizeGitHubBaseUrl(value?: string): string {
  const raw = (value?.trim() || 'https://github.com').replace(/\/+$/, '');
  const parsed = new URL(raw);
  if (
    parsed.protocol !== 'https:' &&
    !(process.env.NODE_ENV === 'test' && parsed.protocol === 'http:')
  ) {
    throw new Error('GitHub base URL must use HTTPS');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('GitHub base URL cannot contain credentials, query parameters, or fragments');
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
}

export function githubApiBase(baseUrl: string): string {
  const normalized = normalizeGitHubBaseUrl(baseUrl);
  return normalized === 'https://github.com' ? 'https://api.github.com' : `${normalized}/api/v3`;
}

export function githubGraphqlUrl(baseUrl: string): string {
  const normalized = normalizeGitHubBaseUrl(baseUrl);
  return normalized === 'https://github.com'
    ? 'https://api.github.com/graphql'
    : `${normalized}/api/graphql`;
}

export function parseGitHubIssueRef(id: string, project?: string): GitHubIssueRef {
  const canonical = id.match(/^([^/\s]+)\/([^#/\s]+)#(\d+)$/);
  if (canonical) {
    return { owner: canonical[1], repo: canonical[2], number: Number(canonical[3]) };
  }
  const repository = project?.match(/^([^/\s]+)\/([^/\s]+)$/);
  const number = Number(id);
  if (!repository || !Number.isSafeInteger(number) || number < 1) {
    throw new Error(`GitHub issue id must be "owner/repository#number"`);
  }
  return { owner: repository[1], repo: repository[2], number };
}

export function githubIssueId(ref: GitHubIssueRef): string {
  return `${ref.owner}/${ref.repo}#${ref.number}`;
}
