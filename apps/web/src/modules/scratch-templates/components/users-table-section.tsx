'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import type { UserProvisionSlot, UserProvisionTemplate } from '@sfcc/shared';
import type { ConaUserRow } from '../types';

interface PicklistField {
  name: string;
  values: string[];
}

const EMPTY_SLOT: UserProvisionSlot = {
  templateId: '',
  firstName: '',
  lastName: '',
  email: '',
};

function picklistValues(fields: PicklistField[], name: string): string[] {
  return fields.find((f) => f.name === name)?.values ?? [];
}

interface UsersTableSectionProps {
  sourceOrgId?: string;
  templates: UserProvisionTemplate[];
  slots: UserProvisionSlot[];
  legacyUsers: ConaUserRow[];
  onTemplatesChange: (templates: UserProvisionTemplate[]) => void;
  onSlotsChange: (slots: UserProvisionSlot[]) => void;
  onLegacyUsersChange: (users: ConaUserRow[]) => void;
}

export function UsersTableSection({
  sourceOrgId,
  templates,
  slots,
  legacyUsers,
  onTemplatesChange,
  onSlotsChange,
}: UsersTableSectionProps) {
  const [picklists, setPicklists] = useState<PicklistField[]>([]);
  const [loading, setLoading] = useState(false);
  const [templatesJsonError, setTemplatesJsonError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    if (!sourceOrgId) {
      setPicklists([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ picklists: PicklistField[] }>(`/provisioning/orgs/${sourceOrgId}/discover`);
      setPicklists(res.picklists);
    } catch {
      setPicklists([]);
    } finally {
      setLoading(false);
    }
  }, [sourceOrgId]);

  useEffect(() => {
    void discover();
  }, [discover]);

  const roleOptions = picklistValues(picklists, 'cfs_ob__Onboarding_Role__c');
  const bottlerOptions = picklistValues(picklists, 'cfs_ob__Bottler__c');

  const updateSlot = (index: number, patch: Partial<UserProvisionSlot>) => {
    onSlotsChange(slots.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const applyTemplate = (index: number, templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    updateSlot(index, {
      templateId,
      role: tmpl.role,
      bottler: tmpl.bottler,
      modules: tmpl.modules,
      locations: tmpl.locations,
    });
  };

  const handleTemplatesJsonUpload = async (file: File | null) => {
    setTemplatesJsonError(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { templates?: UserProvisionTemplate[] };
      if (!parsed.templates?.length) throw new Error('JSON must include templates[]');
      onTemplatesChange(parsed.templates);
    } catch (e) {
      setTemplatesJsonError(e instanceof Error ? e.message : 'Invalid templates JSON');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="user-templates-json">User templates (config-driven)</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload bottler-wise templates JSON or use templates saved with this preset. Slots pick a
          template and set name/email.
        </p>
        <input
          id="user-templates-json"
          type="file"
          accept=".json,application/json"
          className="mt-2 text-xs"
          onChange={(e) => void handleTemplatesJsonUpload(e.target.files?.[0] ?? null)}
        />
        {templatesJsonError && <p className="text-xs text-destructive mt-1">{templatesJsonError}</p>}
        {templates.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">{templates.length} template(s) loaded</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sourceOrgId
            ? loading
              ? 'Loading picklists…'
              : 'Picklists from data deployment org'
            : 'Select data deployment org on Source orgs step'}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => onSlotsChange([...slots, { ...EMPTY_SLOT }])}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add user
        </Button>
      </div>

      <div className="space-y-3">
        {slots.length === 0 && legacyUsers.length === 0 && (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border/60 p-4 text-center">
            No users configured. Add a user slot or upload user templates JSON.
          </p>
        )}
        {slots.map((slot, i) => {
          const tmpl = templates.find((t) => t.id === slot.templateId);
          return (
            <div key={`slot-${i}`} className="rounded-lg border border-border/60 p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">User {i + 1}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onSlotsChange(slots.filter((_, idx) => idx !== i))}
                  aria-label={`Remove user ${i + 1}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  aria-label={`User ${i + 1} template`}
                  value={slot.templateId}
                  onChange={(e) => applyTemplate(i, e.target.value)}
                >
                  <option value="">Select template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.bottler})
                    </option>
                  ))}
                </Select>
                <Select aria-label={`User ${i + 1} role`} value={slot.role ?? tmpl?.role ?? ''} onChange={(e) => updateSlot(i, { role: e.target.value })}>
                  <option value="">Role…</option>
                  {(roleOptions.length ? roleOptions : [tmpl?.role ?? 'Master Data']).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
                <Input aria-label={`User ${i + 1} first name`} placeholder="First name" value={slot.firstName} onChange={(e) => updateSlot(i, { firstName: e.target.value })} />
                <Input aria-label={`User ${i + 1} last name`} placeholder="Last name" value={slot.lastName} onChange={(e) => updateSlot(i, { lastName: e.target.value })} />
                <Input aria-label={`User ${i + 1} email`} placeholder="Email" type="email" className="sm:col-span-2" value={slot.email} onChange={(e) => updateSlot(i, { email: e.target.value })} />
              </div>
              {tmpl && (
                <p className="text-xs text-muted-foreground">
                  Modules: {tmpl.modules.join(', ') || '—'} · Locations: {tmpl.locations.join(', ') || '—'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function usersToApiFormat(users: ConaUserRow[]) {
  return users
    .filter((u) => u.email && u.firstName && u.lastName && u.role)
    .map((u) => ({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      bottler: u.bottler,
      modules: u.modules.length ? u.modules : undefined,
      locations: u.locations.length ? u.locations : undefined,
    }));
}

export function slotsToApiFormat(slots: UserProvisionSlot[]) {
  return slots.filter((s) => s.templateId && s.email && s.firstName && s.lastName);
}

export function apiUsersToRows(
  users?: Array<{
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    bottler: string;
    modules?: string[];
    locations?: string[];
  }>,
): ConaUserRow[] {
  return (users ?? []).map((u) => ({
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    bottler: u.bottler,
    modules: u.modules ?? [],
    locations: u.locations ?? [],
  }));
}

export function apiSlotsToRows(slots?: UserProvisionSlot[]): UserProvisionSlot[] {
  return slots ?? [];
}
