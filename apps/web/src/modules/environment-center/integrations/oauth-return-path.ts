export type OAuthProvider = 'github' | 'bitbucket' | 'jira';

const OAUTH_RETURN_PATHS: Record<OAuthProvider, string> = {
  github: '/environment-center?tab=github',
  bitbucket: '/environment-center?tab=bitbucket',
  jira: '/environment-center?tab=jira',
};

export function oauthReturnPath(provider: OAuthProvider): string {
  return OAUTH_RETURN_PATHS[provider];
}
