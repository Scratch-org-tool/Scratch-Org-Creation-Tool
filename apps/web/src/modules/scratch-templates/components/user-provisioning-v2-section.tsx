'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import {
  generateEmailStyleUsername,
  normalizeRoleSlug,
  resolveUserProvisioningPlan,
  type ConcreteProvisionUser,
  type RoleBottlerMapping,
  type UserGenerator,
  type UserProvisioningConfig,
  type UserProvisionTeam,
} from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import { provisioningPreviewIsValid } from '../template-form-utils';

interface PicklistField {
  name: string;
  values: string[];
}

interface DiscoveryResult {
  alias: string;
  picklists: PicklistField[];
  profiles: Array<{ Id: string; Name: string }>;
  permissionSets: Array<{ Id: string; Name: string; Label: string }>;
  missingFields: string[];
}

interface ProvisioningPlanPreview {
  ok: boolean;
  users: ReturnType<typeof resolveUserProvisioningPlan>;
  metadata: DiscoveryResult | null;
  errors: string[];
  warnings: string[];
}

function picklistValues(fields: PicklistField[], name: string): string[] {
  return fields.find((field) => field.name === name)?.values ?? [];
}

function listText(values?: string[]): string {
  return values?.join(', ') ?? '';
}

function parseList(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function uniqueId(prefix: string, ids: readonly string[]): string {
  let suffix = ids.length + 1;
  while (ids.includes(`${prefix}-${suffix}`)) suffix += 1;
  return `${prefix}-${suffix}`;
}

function emptyMapping(): RoleBottlerMapping {
  return {
    role: '',
    bottler: '',
    permissionSets: [],
    modules: [],
    locations: [],
  };
}

function emptyTeam(ids: readonly string[]): UserProvisionTeam {
  return {
    id: uniqueId('team', ids),
    name: 'Team',
    emailPool: {
      emails: ['team@example.com'],
      allocation: 'shuffled_round_robin',
      allowReuse: false,
      seed: 'automation_run',
    },
  };
}

function emptyGenerator(ids: readonly string[], teamId?: string): UserGenerator {
  return {
    id: uniqueId('users', ids),
    count: 1,
    role: 'User',
    bottler: '5000',
    teamId,
    firstNamePrefix: 'Generated',
  };
}

function emptyUser(): ConcreteProvisionUser {
  return {
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    bottler: '',
    modules: [],
    locations: [],
  };
}

export function countConfiguredUsers(config?: UserProvisioningConfig): number {
  if (!config) return 0;
  try {
    return resolveUserProvisioningPlan(config, 'count-preview').length;
  } catch {
    return 0;
  }
}

export function UserProvisioningV2Section({
  sourceOrgId,
  value,
  onChange,
  onValidationChange,
}: {
  sourceOrgId?: string;
  value: UserProvisioningConfig;
  onChange: (value: UserProvisioningConfig) => void;
  onValidationChange?: (state: { valid: boolean; checking: boolean }) => void;
}) {
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [previewSeed, setPreviewSeed] = useState('template-preview');
  const [planPreview, setPlanPreview] = useState<ProvisioningPlanPreview | null>(null);
  const [planChecking, setPlanChecking] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    if (!sourceOrgId) {
      setDiscovery(null);
      return;
    }
    setDiscovering(true);
    setDiscoveryError(null);
    try {
      setDiscovery(await api<DiscoveryResult>(`/provisioning/orgs/${sourceOrgId}/discover`));
    } catch (error) {
      setDiscovery(null);
      setDiscoveryError(error instanceof Error ? error.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }, [sourceOrgId]);

  useEffect(() => {
    void discover();
  }, [discover]);

  const roles = picklistValues(discovery?.picklists ?? [], 'cfs_ob__Onboarding_Role__c');
  const bottlers = picklistValues(discovery?.picklists ?? [], 'cfs_ob__Bottler__c');
  const discoveredModules = picklistValues(discovery?.picklists ?? [], 'cfs_ob__Modules__c');
  const discoveredLocations = picklistValues(discovery?.picklists ?? [], 'cfs_ob__u_Locations__c');
  const mappings = value.roleBottlerMappings ?? [];
  const teams = value.teams ?? [];
  const generators = value.userGenerators ?? [];

  useEffect(() => {
    if (!sourceOrgId) {
      setPlanPreview(null);
      setPlanError('Select a Data Deployment Org to validate the provisioning plan.');
      setPlanChecking(false);
      onValidationChange?.({ valid: false, checking: false });
      return;
    }
    const controller = new AbortController();
    setPlanChecking(true);
    setPlanError(null);
    onValidationChange?.({ valid: false, checking: true });
    const timer = setTimeout(() => {
      void api<ProvisioningPlanPreview>('/provisioning/plan/preview', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          orgId: sourceOrgId,
          automationRunId: previewSeed,
          config: value,
        }),
      }).then((result) => {
        if (controller.signal.aborted) return;
        setPlanPreview(result);
        if (result.metadata) setDiscovery(result.metadata);
        onValidationChange?.({
          valid: provisioningPreviewIsValid(result),
          checking: false,
        });
      }).catch((error) => {
        if (controller.signal.aborted) return;
        setPlanPreview(null);
        setPlanError(error instanceof Error ? error.message : 'Provisioning plan preview failed');
        onValidationChange?.({ valid: false, checking: false });
      }).finally(() => {
        if (!controller.signal.aborted) setPlanChecking(false);
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [onValidationChange, previewSeed, sourceOrgId, value]);

  const generatedPreview = planPreview?.users ?? [];
  const profiles = discovery?.profiles ?? [];
  const permissionSets = discovery?.permissionSets ?? [];

  const patch = (next: Partial<UserProvisioningConfig>) => onChange({
    ...value,
    discoveryPolicy: value.discoveryPolicy ?? 'best_effort',
    execution: value.execution ?? {
      mode: 'sequential',
      concurrency: 1,
      failurePolicy: 'fail_fast',
      discoveryFailurePolicy: 'fail',
    },
    ...next,
  });

  const updateMapping = (index: number, update: Partial<RoleBottlerMapping>) =>
    patch({ roleBottlerMappings: mappings.map((mapping, itemIndex) => itemIndex === index ? { ...mapping, ...update } : mapping) });
  const updateTeam = (index: number, update: Partial<UserProvisionTeam>) =>
    patch({ teams: teams.map((team, itemIndex) => itemIndex === index ? { ...team, ...update } : team) });
  const updateGenerator = (index: number, update: Partial<UserGenerator>) =>
    patch({ userGenerators: generators.map((generator, itemIndex) => itemIndex === index ? { ...generator, ...update } : generator) });

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border/60 p-4 space-y-3" aria-labelledby="discovery-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="discovery-title" className="text-sm font-medium">Source / target discovery preview</h3>
            <p className="text-xs text-muted-foreground">
              Preview roles, bottlers, profiles, permission sets, modules, and locations. The
              server validates the resolved provisioning plan against this org before save.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" loading={discovering} disabled={!sourceOrgId} onClick={() => void discover()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Discover
          </Button>
        </div>
        {!sourceOrgId && <p className="text-xs text-muted-foreground">Select a Data Deployment Org first.</p>}
        {discovery && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {[
              ['Roles', roles],
              ['Bottlers', bottlers],
              ['Profiles', profiles.map((profile) => profile.Name)],
              ['Permission sets', permissionSets.map((permissionSet) => permissionSet.Name)],
              ['Modules', discoveredModules],
              ['Locations', discoveredLocations],
            ].map(([label, items]) => (
              <div key={label as string} className="rounded-md bg-muted/30 p-2">
                <p className="font-medium">{label as string}</p>
                <p className="text-muted-foreground break-words">{(items as string[]).join(', ') || 'None discovered'}</p>
              </div>
            ))}
          </div>
        )}
        {discoveryError && <InlineAlert variant="warning">{discoveryError}</InlineAlert>}
      </section>

      <section className="space-y-3" aria-labelledby="mapping-title">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 id="mapping-title" className="text-sm font-medium">Role + bottler mappings</h3>
            <p className="text-xs text-muted-foreground">Map a requested role to Salesforce role/profile, permission sets, modules, and locations.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => patch({ roleBottlerMappings: [...mappings, emptyMapping()] })}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add mapping
          </Button>
        </div>
        {mappings.map((mapping, index) => (
          <div key={`${mapping.role}-${mapping.bottler}-${index}`} className="rounded-lg border border-border/60 p-3 space-y-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div>
                <Label htmlFor={`mapping-${index}-role`}>Template role</Label>
                <Input id={`mapping-${index}-role`} list="discovered-roles" value={mapping.role} onChange={(event) => updateMapping(index, { role: event.target.value })} />
              </div>
              <div>
                <Label htmlFor={`mapping-${index}-bottler`}>Bottler</Label>
                <Input id={`mapping-${index}-bottler`} list="discovered-bottlers" value={mapping.bottler} onChange={(event) => updateMapping(index, { bottler: event.target.value })} />
              </div>
              <div>
                <Label htmlFor={`mapping-${index}-sf-role`}>Salesforce role</Label>
                <Input id={`mapping-${index}-sf-role`} value={mapping.salesforceRole ?? ''} onChange={(event) => updateMapping(index, { salesforceRole: event.target.value || undefined })} />
              </div>
              <div>
                <Label htmlFor={`mapping-${index}-profile`}>Profile</Label>
                <Input id={`mapping-${index}-profile`} list="discovered-profiles" value={mapping.profile ?? ''} onChange={(event) => updateMapping(index, { profile: event.target.value || undefined })} />
              </div>
              <div>
                <Label htmlFor={`mapping-${index}-permissions`}>Permission sets</Label>
                <Input id={`mapping-${index}-permissions`} list="discovered-permission-sets" value={listText(mapping.permissionSets)} onChange={(event) => updateMapping(index, { permissionSets: parseList(event.target.value) })} />
              </div>
              <div>
                <Label htmlFor={`mapping-${index}-modules`}>Modules</Label>
                <Input id={`mapping-${index}-modules`} value={listText(mapping.modules)} onChange={(event) => updateMapping(index, { modules: parseList(event.target.value) })} />
              </div>
              <div>
                <Label htmlFor={`mapping-${index}-locations`}>Locations</Label>
                <Input id={`mapping-${index}-locations`} value={listText(mapping.locations)} onChange={(event) => updateMapping(index, { locations: parseList(event.target.value) })} />
              </div>
              <div className="flex items-end justify-end">
                <Button type="button" size="sm" variant="ghost" aria-label={`Delete mapping ${index + 1}`} onClick={() => patch({ roleBottlerMappings: mappings.filter((_, itemIndex) => itemIndex !== index) })}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <datalist id="discovered-roles">{roles.map((role) => <option key={role} value={role} />)}</datalist>
        <datalist id="discovered-bottlers">{bottlers.map((bottler) => <option key={bottler} value={bottler} />)}</datalist>
        <datalist id="discovered-profiles">{profiles.map((profile) => <option key={profile.Id} value={profile.Name} />)}</datalist>
        <datalist id="discovered-permission-sets">{permissionSets.map((permissionSet) => <option key={permissionSet.Id} value={permissionSet.Name} />)}</datalist>
      </section>

      <section className="space-y-3" aria-labelledby="email-pools-title">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 id="email-pools-title" className="text-sm font-medium">Team email pools</h3>
            <p className="text-xs text-muted-foreground">Emails are deterministically shuffled, then assigned round-robin. Reuse is always explicit.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => patch({ teams: [...teams, emptyTeam(teams.map((team) => team.id))] })}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add team
          </Button>
        </div>
        {teams.map((team, index) => (
          <div key={team.id} className="rounded-lg border border-border/60 p-3 grid sm:grid-cols-[1fr_2fr_auto] gap-3 items-start">
            <div className="space-y-2">
              <div>
                <Label htmlFor={`team-${index}-name`}>Team name</Label>
                <Input id={`team-${index}-name`} value={team.name ?? ''} onChange={(event) => updateTeam(index, { name: event.target.value })} />
              </div>
              <div>
                <Label htmlFor={`team-${index}-id`}>Stable team ID</Label>
                <Input id={`team-${index}-id`} value={team.id} onChange={(event) => updateTeam(index, { id: event.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor={`team-${index}-emails`}>Email pool (one per line)</Label>
              <Textarea
                id={`team-${index}-emails`}
                className="min-h-24"
                value={team.emailPool.emails.join('\n')}
                onChange={(event) => updateTeam(index, {
                  emailPool: { ...team.emailPool, emails: parseList(event.target.value) },
                })}
              />
              <label className="flex items-center gap-2 text-xs mt-2">
                <input
                  type="checkbox"
                  checked={team.emailPool.allowReuse}
                  onChange={(event) => updateTeam(index, {
                    emailPool: { ...team.emailPool, allowReuse: event.target.checked },
                  })}
                />
                Allow reuse when generated users outnumber emails
              </label>
            </div>
            <Button type="button" size="sm" variant="ghost" aria-label={`Delete ${team.name ?? team.id}`} onClick={() => patch({ teams: teams.filter((_, itemIndex) => itemIndex !== index) })}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-3" aria-labelledby="generators-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="generators-title" className="text-sm font-medium">User generators</h3>
            <p className="text-xs text-muted-foreground">Select multiple discovered roles or add one custom role; generated rows may share a base name and team pool.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {roles.length > 0 && (
              <div>
                <Label htmlFor="generator-multi-role">Add multiple roles</Label>
                <Select
                  id="generator-multi-role"
                  multiple
                  className="min-h-20 min-w-48"
                  value={[]}
                  onChange={(event) => {
                    const selected = Array.from(event.target.selectedOptions, (option) => option.value);
                    const next = [...generators];
                    for (const role of selected) {
                      next.push({
                        ...emptyGenerator(next.map((generator) => generator.id), teams[0]?.id),
                        role,
                      });
                    }
                    patch({ userGenerators: next });
                  }}
                >
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </Select>
              </div>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => patch({ userGenerators: [...generators, emptyGenerator(generators.map((generator) => generator.id), teams[0]?.id)] })}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add custom role
            </Button>
          </div>
        </div>
        {generators.map((generator, index) => (
          <div key={generator.id} className="rounded-lg border border-border/60 p-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div>
                <Label htmlFor={`generator-${index}-id`}>Generator ID</Label>
                <Input id={`generator-${index}-id`} value={generator.id} onChange={(event) => updateGenerator(index, { id: event.target.value })} />
              </div>
              <div>
                <Label htmlFor={`generator-${index}-count`}>Count</Label>
                <Input id={`generator-${index}-count`} type="number" min={1} value={generator.count} onChange={(event) => updateGenerator(index, { count: Number(event.target.value) })} />
              </div>
              <div>
                <Label htmlFor={`generator-${index}-role`}>Role</Label>
                <Select id={`generator-${index}-role`} value={generator.role} onChange={(event) => updateGenerator(index, { role: event.target.value })}>
                  {!roles.includes(generator.role) && <option value={generator.role}>{generator.role}</option>}
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor={`generator-${index}-bottler`}>Bottler</Label>
                <Select id={`generator-${index}-bottler`} value={generator.bottler} onChange={(event) => updateGenerator(index, { bottler: event.target.value })}>
                  {!bottlers.includes(generator.bottler) && <option value={generator.bottler}>{generator.bottler}</option>}
                  {bottlers.map((bottler) => <option key={bottler} value={bottler}>{bottler}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor={`generator-${index}-team`}>Team email pool</Label>
                <Select id={`generator-${index}-team`} value={generator.teamId ?? ''} onChange={(event) => updateGenerator(index, { teamId: event.target.value || undefined })}>
                  <option value="">Generated email policy</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.name ?? team.id}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor={`generator-${index}-first-prefix`}>Base first name</Label>
                <Input id={`generator-${index}-first-prefix`} value={generator.firstNamePrefix} onChange={(event) => updateGenerator(index, { firstNamePrefix: event.target.value })} />
              </div>
              <div>
                <Label htmlFor={`generator-${index}-last-prefix`}>Base last name</Label>
                <Input id={`generator-${index}-last-prefix`} value={generator.lastNamePrefix ?? ''} onChange={(event) => updateGenerator(index, { lastNamePrefix: event.target.value || undefined })} />
              </div>
              <div className="flex items-end justify-end">
                <Button type="button" size="sm" variant="ghost" aria-label={`Delete generator ${generator.id}`} onClick={() => patch({ userGenerators: generators.filter((_, itemIndex) => itemIndex !== index) })}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border/60 p-4 space-y-3" aria-labelledby="user-policy-title">
        <h3 id="user-policy-title" className="text-sm font-medium">Email, username, and execution policy</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label htmlFor="user-default-profile">Default profile</Label>
            <Input
              id="user-default-profile"
              list="discovered-profiles"
              value={value.defaultProfile ?? ''}
              onChange={(event) => patch({ defaultProfile: event.target.value || undefined })}
            />
          </div>
          <div>
            <Label htmlFor="user-email-strategy">Email source</Label>
            <Select
              id="user-email-strategy"
              value={value.emailPolicy?.strategy ?? 'provided'}
              onChange={(event) => patch({ emailPolicy: {
                strategy: event.target.value as 'provided' | 'team_pool' | 'generated',
                domain: value.emailPolicy?.domain,
                seed: 'automation_run',
              } })}
            >
              <option value="provided">Provided / per-role override</option>
              <option value="team_pool">Team pool</option>
              <option value="generated">Generated</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="user-email-domain">Generated email domain</Label>
            <Input
              id="user-email-domain"
              placeholder="example.com"
              value={value.emailPolicy?.domain ?? ''}
              onChange={(event) => patch({ emailPolicy: {
                strategy: value.emailPolicy?.strategy ?? 'generated',
                domain: event.target.value || undefined,
                seed: 'automation_run',
              } })}
            />
          </div>
          <div>
            <Label htmlFor="user-username-domain">Username domain</Label>
            <Input
              id="user-username-domain"
              placeholder="example.com"
              value={value.usernamePolicy?.domain ?? ''}
              onChange={(event) => patch({ usernamePolicy: {
                strategy: 'email_style',
                domain: event.target.value || undefined,
                seed: 'automation_run',
              } })}
            />
            <p className="text-xs text-muted-foreground mt-1">Username is unique Salesforce login; it is not the contact Email.</p>
          </div>
          <div>
            <Label htmlFor="user-discovery-policy">Discovery policy</Label>
            <Select id="user-discovery-policy" value={value.discoveryPolicy ?? 'best_effort'} onChange={(event) => patch({ discoveryPolicy: event.target.value as 'strict' | 'best_effort' | 'disabled' })}>
              <option value="strict">Strict</option>
              <option value="best_effort">Best effort</option>
              <option value="disabled">Disabled</option>
            </Select>
          </div>
        </div>
        <div className="rounded-md bg-muted/30 p-3 text-xs">
          <strong>Sequential execution:</strong> concurrency 1. Each user completes before the next starts; retries resume the failed user using the saved allocation.
        </div>
        {value.emailPolicy?.strategy === 'generated' && !value.emailPolicy.domain && (
          <InlineAlert variant="error">Set a real email domain; placeholder addresses are never invented.</InlineAlert>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="explicit-users-title">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 id="explicit-users-title" className="text-sm font-medium">Explicit users and per-role overrides</h3>
            <p className="text-xs text-muted-foreground">
              Set a real Email and, optionally, a distinct Salesforce Username. Reduce the matching generator count when this row replaces a generated user.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => patch({ users: [...(value.users ?? []), emptyUser()] })}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add explicit user
          </Button>
        </div>
        {(value.users ?? []).map((user, index) => {
          const updateUser = (update: Partial<ConcreteProvisionUser>) =>
            patch({ users: value.users!.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item) });
          return (
            <div key={`${user.email}-${index}`} className="rounded-lg border border-border/60 p-3">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <Label htmlFor={`explicit-${index}-first`}>First name</Label>
                  <Input id={`explicit-${index}-first`} value={user.firstName} onChange={(event) => updateUser({ firstName: event.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`explicit-${index}-last`}>Last name</Label>
                  <Input id={`explicit-${index}-last`} value={user.lastName} onChange={(event) => updateUser({ lastName: event.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`explicit-${index}-role`}>Role</Label>
                  <Input id={`explicit-${index}-role`} list="discovered-roles" value={user.role} onChange={(event) => updateUser({ role: event.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`explicit-${index}-bottler`}>Bottler</Label>
                  <Input id={`explicit-${index}-bottler`} list="discovered-bottlers" value={user.bottler} onChange={(event) => updateUser({ bottler: event.target.value })} />
                </div>
                <div className="lg:col-span-2">
                  <Label htmlFor={`explicit-${index}-email`}>Email</Label>
                  <Input id={`explicit-${index}-email`} type="email" value={user.email} onChange={(event) => updateUser({ email: event.target.value })} />
                </div>
                <div className="lg:col-span-2">
                  <Label htmlFor={`explicit-${index}-username`}>Salesforce Username (optional unique login)</Label>
                  <Input id={`explicit-${index}-username`} value={user.username ?? ''} onChange={(event) => updateUser({ username: event.target.value || undefined })} />
                </div>
                <div>
                  <Label htmlFor={`explicit-${index}-modules`}>Modules</Label>
                  <Input id={`explicit-${index}-modules`} value={listText(user.modules)} onChange={(event) => updateUser({ modules: parseList(event.target.value) })} />
                </div>
                <div>
                  <Label htmlFor={`explicit-${index}-locations`}>Locations</Label>
                  <Input id={`explicit-${index}-locations`} value={listText(user.locations)} onChange={(event) => updateUser({ locations: parseList(event.target.value) })} />
                </div>
                <div>
                  <Label htmlFor={`explicit-${index}-permsets`}>Permission sets</Label>
                  <Input id={`explicit-${index}-permsets`} list="discovered-permission-sets" value={listText(user.permissionSets)} onChange={(event) => updateUser({ permissionSets: parseList(event.target.value) })} />
                </div>
                <div>
                  <Label htmlFor={`explicit-${index}-profile`}>Profile</Label>
                  <Input id={`explicit-${index}-profile`} list="discovered-profiles" value={user.profile ?? ''} onChange={(event) => updateUser({ profile: event.target.value || undefined })} />
                </div>
                <div className="flex items-end justify-end">
                  <Button type="button" size="sm" variant="ghost" aria-label={`Delete explicit user ${index + 1}`} onClick={() => patch({ users: value.users!.filter((_, itemIndex) => itemIndex !== index) })}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3" aria-labelledby="generated-preview-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 id="generated-preview-title" className="text-sm font-medium">Generated user preview</h3>
            <p className="text-xs text-muted-foreground">Role → Email → unique Username → modules / locations / permission sets.</p>
          </div>
          <div>
            <Label htmlFor="user-preview-seed">Preview seed</Label>
            <Input id="user-preview-seed" value={previewSeed} onChange={(event) => setPreviewSeed(event.target.value || 'template-preview')} />
          </div>
        </div>
        {planChecking && <p className="text-xs text-muted-foreground">Validating server provisioning plan…</p>}
        {planError && <InlineAlert variant="error">{planError}</InlineAlert>}
        {planPreview?.errors.map((error) => (
          <InlineAlert key={error} variant="error">{error}</InlineAlert>
        ))}
        {planPreview?.warnings.map((warning) => (
          <InlineAlert key={warning} variant="warning">{warning}</InlineAlert>
        ))}
        {generatedPreview.length ? (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-left">
                <tr>
                  <th className="p-2">Name / role</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Username</th>
                  <th className="p-2">Access</th>
                </tr>
              </thead>
              <tbody>
                {generatedPreview.map((user, index) => (
                  <tr key={`${'generatorId' in user ? user.generatorId : user.email}-${index}`} className="border-t border-border/50 align-top">
                    <td className="p-2">{user.firstName} {user.lastName}<br /><span className="text-muted-foreground">{user.role} · {user.bottler}</span></td>
                    <td className="p-2 break-all"><span className="font-medium">Email:</span> {user.email}</td>
                    <td className="p-2 break-all"><span className="font-medium">Username:</span> {user.username}</td>
                    <td className="p-2">
                      Profile: {user.profile ?? '—'}<br />
                      Modules: {user.modules.join(', ') || '—'}<br />
                      Locations: {user.locations.join(', ') || '—'}<br />
                      Permission sets: {user.permissionSets?.join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !planChecking && !planError ? (
          <div className="rounded-lg border border-dashed border-border/60 p-5 text-center text-sm text-muted-foreground">
            <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
            Add a generator and valid email policy to preview users.
          </div>
        ) : null}
      </section>

      {((value.templates?.length ?? 0) > 0 || (value.slots?.length ?? 0) > 0 || (value.users?.length ?? 0) > 0) && (
        <InlineAlert variant="info" title="Legacy users imported">
          {value.templates?.length ?? 0} templates, {value.slots?.length ?? 0} slots, and {value.users?.length ?? 0} concrete users remain visible and stored for legacy execution paths.
        </InlineAlert>
      )}
    </div>
  );
}

export function runtimeUsernamePreview(email: string, role: string, domain?: string): string {
  return generateEmailStyleUsername({
    email,
    domain,
    uniqueKey: normalizeRoleSlug(role),
  });
}
