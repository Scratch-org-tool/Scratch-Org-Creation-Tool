'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CONA_BOTTLERS,
  CONA_BOTTLER_LABELS,
  DEFAULT_LIFECYCLE_PROFILE,
  DEFAULT_LIFECYCLE_USERNAME_PATTERN,
  expandLifecycleUsers,
  resolveBottlerLabel,
  type LifecycleProvisionUser,
} from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { FormSection, GlassCard, InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';

interface PicklistField {
  name: string;
  values: string[];
  controllerName?: string;
  dependencies?: Array<{ value: string; validFor: string[] }>;
}

interface DiscoverResponse {
  picklists: PicklistField[];
  profiles: Array<{ Id: string; Name: string }>;
  missingFields: string[];
}

const BOTTLER_FIELD = 'cfs_ob__Bottler__c';
const ROLE_FIELD = 'cfs_ob__Onboarding_Role__c';
const MODULES_FIELD = 'cfs_ob__Modules__c';
const LOCATIONS_FIELD = 'cfs_ob__u_Locations__c';

/** Fallback when the org's User object lacks the CONA fields (matches the Apex script's role set). */
const FALLBACK_ROLES = [
  'Requestor', 'Master Data', 'Distribution', 'Equipment', 'Router',
  'Pricing', 'AR Supervisor', 'Finance', 'Manager',
];

/** Values valid for the selected bottler, using the org's dependent-picklist metadata. */
function validValuesForBottler(field: PicklistField | undefined, bottler: string): string[] {
  if (!field) return [];
  if (field.controllerName !== BOTTLER_FIELD || !field.dependencies) return field.values;
  return field.dependencies
    .filter((dependency) => dependency.validFor.includes(bottler))
    .map((dependency) => dependency.value);
}

function parseEmails(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

function CheckboxChips({
  idPrefix,
  options,
  selected,
  onToggle,
}: {
  idPrefix: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-1 max-h-32 overflow-y-auto">
      {options.map((option) => (
        <label key={option} htmlFor={`${idPrefix}-${option}`} className="flex items-center gap-1 text-xs border rounded px-2 py-1">
          <input
            id={`${idPrefix}-${option}`}
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
          />
          {option}
        </label>
      ))}
    </div>
  );
}

export function LifecycleUserGeneratorForm({ embedded }: { embedded?: boolean } = {}) {
  const { orgs } = useOrgs();
  const [orgId, setOrgId] = useState('');
  const [metadata, setMetadata] = useState<DiscoverResponse | null>(null);
  const [bottler, setBottler] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [emailsText, setEmailsText] = useState('');
  const [usernamePattern, setUsernamePattern] = useState(DEFAULT_LIFECYCLE_USERNAME_PATTERN);
  const [profile, setProfile] = useState(DEFAULT_LIFECYCLE_PROFILE);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; variant: 'success' | 'error' } | null>(null);

  const discover = useCallback(async () => {
    if (!orgId) return;
    setLoadingDiscover(true);
    setMessage(null);
    try {
      const res = await api<DiscoverResponse>(`/provisioning/orgs/${orgId}/discover`);
      setMetadata(res);
    } catch (err) {
      setMetadata(null);
      setMessage({
        text: err instanceof Error ? err.message : 'Failed to discover org metadata',
        variant: 'error',
      });
    } finally {
      setLoadingDiscover(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) void discover();
  }, [orgId, discover]);

  const field = useCallback(
    (name: string) => metadata?.picklists.find((picklist) => picklist.name === name),
    [metadata],
  );

  const bottlerOptions = field(BOTTLER_FIELD)?.values.length
    ? field(BOTTLER_FIELD)!.values
    : [...CONA_BOTTLERS];
  const roleOptions = validValuesForBottler(field(ROLE_FIELD), bottler);
  const moduleOptions = validValuesForBottler(field(MODULES_FIELD), bottler);
  const locationOptions = validValuesForBottler(field(LOCATIONS_FIELD), bottler);
  const effectiveRoleOptions = roleOptions.length ? roleOptions : FALLBACK_ROLES;

  // Default the bottler (correcting stale values after discovery), then reset
  // the dependent selections (all valid values pre-selected) on bottler change.
  useEffect(() => {
    if (!bottlerOptions.length) return;
    if (!bottler || !bottlerOptions.includes(bottler)) setBottler(bottlerOptions[0]);
  }, [bottler, bottlerOptions]);

  useEffect(() => {
    if (!bottler) return;
    const roleValues = validValuesForBottler(field(ROLE_FIELD), bottler);
    setRoles(roleValues.length ? roleValues : FALLBACK_ROLES);
    setModules(validValuesForBottler(field(MODULES_FIELD), bottler));
    setLocations(validValuesForBottler(field(LOCATIONS_FIELD), bottler));
  }, [bottler, field]);

  const toggle = (setter: (updater: (current: string[]) => string[]) => void) => (value: string) => {
    setter((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  };

  const emails = useMemo(() => parseEmails(emailsText), [emailsText]);
  const hasUniqueToken = /\{unique\}/i.test(usernamePattern);

  const preview = useMemo((): { users: LifecycleProvisionUser[] } | { error: string } | null => {
    if (!bottler || !roles.length || !emails.length || !usernamePattern.includes('@')) return null;
    try {
      return {
        users: expandLifecycleUsers({
          orgId: '00000000-0000-0000-0000-000000000000',
          bottler,
          roles,
          modules,
          locations,
          emails,
          usernamePattern,
          profile,
          seed: 'preview',
          bottlerLabel: resolveBottlerLabel(bottler),
        }),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid configuration' };
    }
  }, [bottler, roles, modules, locations, emails, usernamePattern, profile]);

  const create = async () => {
    if (!orgId) return;
    setLoading(true);
    setMessage(null);
    try {
      if (!roles.length) throw new Error('Select at least one role');
      if (!emails.length) throw new Error('Add at least one email');
      const res = await api<{ batchId: string; jobId: string; totalUsers: number }>(
        '/provisioning/lifecycle-users',
        {
          method: 'POST',
          body: JSON.stringify({
            orgId,
            bottler,
            roles,
            modules,
            locations,
            emails,
            usernamePattern,
            profile,
          }),
        },
      );
      setMessage({
        text: `Queued ${res.totalUsers} lifecycle user(s) — batch ${res.batchId}, job ${res.jobId}`,
        variant: 'success',
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Provisioning failed',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      <FormSection title="Target org">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="lifecycle-target-org">Target Org</Label>
            <Select id="lifecycle-target-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Select…</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.alias}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void discover()} loading={loadingDiscover} disabled={!orgId}>
              Refresh picklists
            </Button>
          </div>
        </div>
        {metadata && metadata.missingFields.length > 0 && (
          <p className="text-xs text-amber-400">
            Missing User fields in this org: {metadata.missingFields.join(', ')}
          </p>
        )}
      </FormSection>

      <FormSection title="Bottler & roles" className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="lifecycle-bottler">Bottler</Label>
            <Select id="lifecycle-bottler" value={bottler} onChange={(e) => setBottler(e.target.value)}>
              {bottlerOptions.map((value) => (
                <option key={value} value={value}>
                  {value === resolveBottlerLabel(value) ? value : `${value} — ${resolveBottlerLabel(value)}`}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="lifecycle-profile">Profile</Label>
            {metadata?.profiles.length ? (
              <Select id="lifecycle-profile" value={profile} onChange={(e) => setProfile(e.target.value)}>
                {metadata.profiles.map((p) => (
                  <option key={p.Id} value={p.Name}>{p.Name}</option>
                ))}
              </Select>
            ) : (
              <Input id="lifecycle-profile" value={profile} onChange={(e) => setProfile(e.target.value)} />
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium leading-none">
            Roles — one user per selected role ({roles.length} selected)
          </p>
          <CheckboxChips
            idPrefix="lifecycle-role"
            options={effectiveRoleOptions}
            selected={roles}
            onToggle={toggle(setRoles)}
          />
        </div>
        {moduleOptions.length > 0 && (
          <div>
            <p className="text-sm font-medium leading-none">Modules (valid for bottler {bottler})</p>
            <CheckboxChips
              idPrefix="lifecycle-module"
              options={moduleOptions}
              selected={modules}
              onToggle={toggle(setModules)}
            />
          </div>
        )}
        {locationOptions.length > 0 && (
          <div>
            <p className="text-sm font-medium leading-none">Locations (valid for bottler {bottler})</p>
            <CheckboxChips
              idPrefix="lifecycle-location"
              options={locationOptions}
              selected={locations}
              onToggle={toggle(setLocations)}
            />
          </div>
        )}
      </FormSection>

      <FormSection title="Emails & usernames" className="mt-6">
        <div>
          <Label htmlFor="lifecycle-emails">Email address(es)</Label>
          <Textarea
            id="lifecycle-emails"
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            placeholder={'one@example.com\ntwo@example.com'}
            className="h-20"
          />
          <p className="text-xs text-muted-foreground mt-1">
            One email: every user gets it. Multiple emails: distributed across the roles
            (shuffled round-robin). {emails.length} email(s) detected.
          </p>
        </div>
        <div>
          <Label htmlFor="lifecycle-username-pattern">Username convention</Label>
          <Input
            id="lifecycle-username-pattern"
            value={usernamePattern}
            onChange={(e) => setUsernamePattern(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Tokens: {'{role}'}, {'{bottler}'}, {'{bottlerLabel}'} (e.g. reyes for 4600), {'{unique}'}.
          </p>
          {!hasUniqueToken && (
            <p className="text-xs text-amber-400 mt-1">
              No {'{unique}'} token — Salesforce usernames are globally unique across all orgs, so
              creation fails if these usernames exist anywhere else.
            </p>
          )}
        </div>
      </FormSection>

      {preview && 'error' in preview && (
        <InlineAlert variant="error" className="mt-4">{preview.error}</InlineAlert>
      )}
      {preview && 'users' in preview && (
        <FormSection title={`Preview — ${preview.users.length} user(s)`} className="mt-6">
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-secondary/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Username</th>
                </tr>
              </thead>
              <tbody>
                {preview.users.map((user) => (
                  <tr key={user.username} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{user.role}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{user.firstName} {user.lastName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{user.email}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{user.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasUniqueToken && (
            <p className="text-xs text-muted-foreground">
              Final {'{unique}'} suffix and email assignment are fixed when the batch is created.
            </p>
          )}
        </FormSection>
      )}

      <div className="flex gap-2 mt-6">
        <Button
          onClick={() => void create()}
          loading={loading}
          disabled={!orgId || !roles.length || !emails.length || Boolean(preview && 'error' in preview)}
        >
          Create Users
        </Button>
      </div>

      {message && (
        <InlineAlert variant={message.variant} className="mt-4">
          {message.text}
        </InlineAlert>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <GlassCard
      title="Lifecycle role users"
      description="Generate one user per Onboarding Role for a bottler, with modules, locations, and permission sets."
    >
      {content}
    </GlassCard>
  );
}
