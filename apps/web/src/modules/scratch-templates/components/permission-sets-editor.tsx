'use client';

import { Input, Label } from '@/components/ui/input';

interface PermissionSetsEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PermissionSetsEditor({ value, onChange }: PermissionSetsEditorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="template-permission-sets">Permission sets to assign</Label>
      <Input
        id="template-permission-sets"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="System_Admin_Extension, Lifecycle_Super_User"
      />
      <p className="text-xs text-muted-foreground">Comma-separated API names assigned after metadata deploy</p>
    </div>
  );
}

export function parsePermissionSets(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatPermissionSets(sets?: string[]): string {
  return sets?.join(', ') ?? '';
}
