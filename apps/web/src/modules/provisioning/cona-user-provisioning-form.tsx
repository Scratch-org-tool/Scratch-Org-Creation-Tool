'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { FormSection, GlassCard, InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import { useOrgs } from '@/hooks/use-orgs';
import { Plus, Trash2 } from 'lucide-react';

interface Org {
  id: string;
  alias: string;
}

interface PicklistField {
  name: string;
  values: string[];
}

export interface ConaUserRow {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  bottler: string;
  modules: string[];
  locations: string[];
}

const EMPTY_USER: ConaUserRow = {
  firstName: '',
  lastName: '',
  email: '',
  role: '',
  bottler: '5000',
  modules: [],
  locations: [],
};

function picklistValues(fields: PicklistField[], name: string): string[] {
  return fields.find((f) => f.name === name)?.values ?? [];
}

export function ConaUserProvisioningForm({ embedded }: { embedded?: boolean } = {}) {
  const { orgs } = useOrgs();
  const [orgId, setOrgId] = useState('');
  const [picklists, setPicklists] = useState<PicklistField[]>([]);
  const [users, setUsers] = useState<ConaUserRow[]>([{ ...EMPTY_USER }]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; variant: 'success' | 'error' } | null>(null);

  const discover = useCallback(async () => {
    if (!orgId) return;
    setLoadingDiscover(true);
    setMessage(null);
    try {
      const res = await api<{ picklists: PicklistField[] }>(`/provisioning/orgs/${orgId}/discover`);
      setPicklists(res.picklists);
    } catch (err) {
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

  const roleOptions = picklistValues(picklists, 'cfs_ob__Onboarding_Role__c');
  const bottlerOptions = picklistValues(picklists, 'cfs_ob__Bottler__c');
  const moduleOptions = picklistValues(picklists, 'cfs_ob__Modules__c');
  const locationOptions = picklistValues(picklists, 'cfs_ob__u_Locations__c');

  const updateUser = (index: number, patch: Partial<ConaUserRow>) => {
    setUsers((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const toggleMulti = (index: number, field: 'modules' | 'locations', value: string) => {
    setUsers((rows) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        const set = new Set(r[field]);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        return { ...r, [field]: [...set] };
      }),
    );
  };

  const provision = async () => {
    if (!orgId) return;
    setLoading(true);
    setMessage(null);
    try {
      const payload = users.filter((u) => u.email && u.firstName && u.lastName && u.role);
      if (!payload.length) throw new Error('Add at least one user with name, email, and role');
      const res = await api<{ jobId: string; totalUsers: number }>('/provisioning/cona-users', {
        method: 'POST',
        body: JSON.stringify({ orgId, users: payload }),
      });
      setMessage({
        text: `Queued ${res.totalUsers} CONA user(s) — job ${res.jobId}`,
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
            <Label htmlFor="cona-users-target-org">Target Org</Label>
            <Select id="cona-users-target-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Select…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.alias}
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
        {picklists.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Loaded {picklists.length} picklist field(s) from org metadata.
          </p>
        )}
      </FormSection>

      <FormSection title="Users" className="mt-6">
        <div className="space-y-4">
          {users.map((user, index) => (
            <div key={index} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">User {index + 1}</span>
                {users.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setUsers((rows) => rows.filter((_, i) => i !== index))}
                    aria-label={`Remove user ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor={`cona-user-${index}-first-name`}>First name</Label>
                  <Input id={`cona-user-${index}-first-name`} value={user.firstName} onChange={(e) => updateUser(index, { firstName: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`cona-user-${index}-last-name`}>Last name</Label>
                  <Input id={`cona-user-${index}-last-name`} value={user.lastName} onChange={(e) => updateUser(index, { lastName: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor={`cona-user-${index}-email`}>Email</Label>
                  <Input id={`cona-user-${index}-email`} type="email" value={user.email} onChange={(e) => updateUser(index, { email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`cona-user-${index}-role`}>Onboarding role</Label>
                  <Select id={`cona-user-${index}-role`} value={user.role} onChange={(e) => updateUser(index, { role: e.target.value })}>
                    <option value="">Select…</option>
                    {(roleOptions.length ? roleOptions : ['Requestor', 'Manager', 'Master Data']).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`cona-user-${index}-bottler`}>Bottler</Label>
                  <Select id={`cona-user-${index}-bottler`} value={user.bottler} onChange={(e) => updateUser(index, { bottler: e.target.value })}>
                    {(bottlerOptions.length ? bottlerOptions : ['5000', '4900', '4600']).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </Select>
                </div>
              </div>
              {moduleOptions.length > 0 && (
                <div>
                  <p className="text-sm font-medium leading-none">Modules</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {moduleOptions.map((m) => (
                      <label key={m} className="flex items-center gap-1 text-xs border rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={user.modules.includes(m)}
                          onChange={() => toggleMulti(index, 'modules', m)}
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {locationOptions.length > 0 && (
                <div>
                  <p className="text-sm font-medium leading-none">Locations</p>
                  <div className="flex flex-wrap gap-2 mt-1 max-h-24 overflow-y-auto">
                    {locationOptions.map((loc) => (
                      <label key={loc} className="flex items-center gap-1 text-xs border rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={user.locations.includes(loc)}
                          onChange={() => toggleMulti(index, 'locations', loc)}
                        />
                        {loc}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1"
          onClick={() => setUsers((rows) => [...rows, { ...EMPTY_USER }])}
        >
          <Plus className="w-4 h-4" />
          Add user
        </Button>
      </FormSection>

      <div className="flex gap-2 mt-6">
        <Button onClick={() => void provision()} loading={loading} disabled={!orgId}>
          Provision CONA users
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
      title="CONA User Provisioning"
      description="Create users with onboarding role, bottler, modules, and locations from org picklists."
    >
      {content}
    </GlassCard>
  );
}
