'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import type { DefectsWorkspaceState } from './use-defects-workspace';
import { parseCsv, providerLabel } from './work-item-contracts';

interface WorkItemEditorDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  w: DefectsWorkspaceState;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  title: string;
  description: string;
  type: string;
  assigneeId: string;
  severity: string;
  priority: string;
  area: string;
  components: string;
  iteration: string;
  labels: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  type: '',
  assigneeId: '',
  severity: '',
  priority: '',
  area: '',
  components: '',
  iteration: '',
  labels: '',
};

export function WorkItemEditorDialog({
  open,
  mode,
  w,
  onOpenChange,
}: WorkItemEditorDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const item = mode === 'edit' ? w.detail : null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(item ? {
      title: item.title,
      description: item.description ?? '',
      type: item.type,
      assigneeId: item.assignee?.id ?? '',
      severity: item.severity ?? '',
      priority: item.priority == null ? '' : String(item.priority),
      area: item.areaPath ?? '',
      components: '',
      iteration: item.iterationPath ?? '',
      labels: item.labels.join(', '),
    } : {
      ...EMPTY_FORM,
      type: w.issueTypes[0] ?? '',
    });
  }, [item, open, w.issueTypes]);

  const set = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setError(null);
    const numericPriority = Number(form.priority);
    const assigneeId = form.assigneeId || null;
    const input = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      ...(w.operations.issueTypes ? { type: form.type || null } : {}),
      ...(w.operations.users
        ? {
            assigneeId,
            assigneeLogins: assigneeId ? [assigneeId] : [],
          }
        : {}),
      severity: form.severity.trim() || null,
      priority: form.priority.trim()
        ? Number.isFinite(numericPriority)
          ? numericPriority
          : form.priority.trim()
        : null,
      area: form.area.trim() || null,
      components: parseCsv(form.components),
      iteration: form.iteration.trim() || null,
      ...(w.operations.labels ? { labels: parseCsv(form.labels) } : {}),
    };
    try {
      if (mode === 'create') await w.createWorkItem(input);
      else await w.updateWorkItem(input);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save work item');
    }
  };

  const isAdmin = w.overview?.isAdminView ?? w.contexts?.isAdmin ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create work item' : `Edit ${item?.id ?? 'work item'}`}</DialogTitle>
          <DialogDescription>
            {providerLabel(w.provider)} · {w.selectedProject}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error && <InlineAlert variant="error">{error}</InlineAlert>}
          {w.sectionErrors.metadata && (
            <InlineAlert variant="warning">{w.sectionErrors.metadata}</InlineAlert>
          )}
          <div>
            <Label htmlFor={`${mode}-work-item-title`}>Title</Label>
            <Input
              id={`${mode}-work-item-title`}
              autoFocus
              required
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
              disabled={w.mutating}
            />
          </div>
          <div>
            <Label htmlFor={`${mode}-work-item-description`}>Description</Label>
            <Textarea
              id={`${mode}-work-item-description`}
              rows={5}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              disabled={w.mutating}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {w.operations.issueTypes && (
              <div>
                <Label htmlFor={`${mode}-work-item-type`}>Issue type</Label>
                <Select
                  id={`${mode}-work-item-type`}
                  value={form.type}
                  onChange={(event) => set('type', event.target.value)}
                  disabled={w.mutating}
                >
                  <option value="">Provider default</option>
                  {[...new Set([item?.type, ...w.issueTypes].filter((value): value is string => Boolean(value)))].map(
                    (type) => <option key={type} value={type}>{type}</option>,
                  )}
                </Select>
              </div>
            )}
            {w.operations.users && (
              <div>
                <Label htmlFor={`${mode}-work-item-assignee`}>Assignee</Label>
                <Select
                  id={`${mode}-work-item-assignee`}
                  value={form.assigneeId}
                  onChange={(event) => set('assigneeId', event.target.value)}
                  disabled={w.mutating || !isAdmin}
                  aria-describedby={!isAdmin ? `${mode}-assignee-help` : undefined}
                >
                  <option value="">Unassigned</option>
                  {w.users.filter((user) => user.id).map((user) => (
                    <option key={user.id!} value={user.id!}>{user.displayName}</option>
                  ))}
                </Select>
                {!isAdmin && (
                  <p id={`${mode}-assignee-help`} className="text-xs text-muted-foreground mt-1">
                    Assignment remains bound to your provider identity.
                  </p>
                )}
              </div>
            )}
            <div>
              <Label htmlFor={`${mode}-work-item-severity`}>Severity</Label>
              <Input
                id={`${mode}-work-item-severity`}
                value={form.severity}
                onChange={(event) => set('severity', event.target.value)}
                placeholder="Provider value"
                disabled={w.mutating}
              />
            </div>
            <div>
              <Label htmlFor={`${mode}-work-item-priority`}>Priority</Label>
              <Input
                id={`${mode}-work-item-priority`}
                value={form.priority}
                onChange={(event) => set('priority', event.target.value)}
                placeholder="Provider value"
                disabled={w.mutating}
              />
            </div>
            <div>
              <Label htmlFor={`${mode}-work-item-area`}>Area</Label>
              <Input
                id={`${mode}-work-item-area`}
                value={form.area}
                onChange={(event) => set('area', event.target.value)}
                placeholder="Area or team"
                disabled={w.mutating}
              />
            </div>
            <div>
              <Label htmlFor={`${mode}-work-item-components`}>Components</Label>
              <Input
                id={`${mode}-work-item-components`}
                value={form.components}
                onChange={(event) => set('components', event.target.value)}
                placeholder="Comma-separated"
                disabled={w.mutating}
              />
            </div>
            <div>
              <Label htmlFor={`${mode}-work-item-iteration`}>Iteration / sprint</Label>
              <Input
                id={`${mode}-work-item-iteration`}
                value={form.iteration}
                onChange={(event) => set('iteration', event.target.value)}
                disabled={w.mutating}
              />
            </div>
            {w.operations.labels && (
              <div>
                <Label htmlFor={`${mode}-work-item-labels`}>Labels</Label>
                <Input
                  id={`${mode}-work-item-labels`}
                  value={form.labels}
                  onChange={(event) => set('labels', event.target.value)}
                  placeholder="Comma-separated"
                  disabled={w.mutating}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={w.mutating}>
              Cancel
            </Button>
            <Button type="submit" loading={w.mutating} disabled={!form.title.trim()}>
              {mode === 'create' ? 'Create' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
