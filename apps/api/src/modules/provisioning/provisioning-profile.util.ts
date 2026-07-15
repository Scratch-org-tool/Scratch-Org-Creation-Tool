export interface ProvisioningProfile {
  Id: string;
  Name: string;
}

export interface ProfiledProvisioningUser {
  email: string;
  username?: string;
  profile?: string;
}

export class ProvisioningProfileValidationError extends Error {}

export function isSalesforceProfileId(value: string): boolean {
  return /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(value);
}

export function provisioningProfileNames(
  users: readonly ProfiledProvisioningUser[],
): string[] {
  return [...new Set(
    users
      .map((user) => user.profile?.trim())
      .filter(
        (profile): profile is string =>
          typeof profile === 'string' && profile.length > 0 && !isSalesforceProfileId(profile),
      ),
  )];
}

/**
 * Canonical profile validation used by previews and workers. Salesforce IDs
 * can be sent directly; human-readable names must be resolved against the
 * target org before a User create is attempted.
 */
export function resolveProvisioningProfileIds<T extends ProfiledProvisioningUser>(
  users: readonly T[],
  profiles: readonly ProvisioningProfile[],
  options: { requireProfile: boolean },
): { users: T[]; profileIds: Map<string, string> } {
  const byName = new Map(profiles.map((profile) => [profile.Name, profile.Id]));
  const profileIds = new Map<string, string>();
  const resolvedUsers = users.map((user) => {
    const profile = user.profile?.trim();
    if (!profile) {
      if (options.requireProfile) {
        throw new ProvisioningProfileValidationError(
          `Profile is required for ${user.username ?? user.email}`,
        );
      }
      return { ...user };
    }
    if (isSalesforceProfileId(profile)) {
      profileIds.set(profile, profile);
      return { ...user, profile };
    }
    const id = byName.get(profile);
    if (!id) {
      throw new ProvisioningProfileValidationError(`Unknown profile: ${profile}`);
    }
    profileIds.set(profile, id);
    profileIds.set(id, id);
    return { ...user, profile: id };
  });
  return { users: resolvedUsers, profileIds };
}
