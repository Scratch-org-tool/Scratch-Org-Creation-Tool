'use client';

import { useState } from 'react';
import { Edit3, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmBanner, GlassCard, InlineAlert, StatusBadge } from '@/components/studio';
import { stripHtmlForDisplay } from '@sfcc/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { DefectCommentsThread } from './defect-comments-thread';
import { DefectHistoryTimeline } from './defect-history-timeline';
import { DefectAttachmentsPanel } from './defect-attachments-panel';
import { DefectSubissuesPanel } from './defect-subissues-panel';
import { WorkItemEditorDialog } from './work-item-editor-dialog';
import {
  workItemStatusBadgeClass,
  workItemStatusItemClass,
  workItemStatusSelectClass,
} from './work-item-status-styles';
import { providerLabel, workItemEndpoint } from './work-item-contracts';
import type { DefectsWorkspaceState } from './use-defects-workspace';

function HtmlField({ label, html }: { label: string; html: string | null }) {
  if (!html?.trim()) return null;
  const text = stripHtmlForDisplay(html);
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
    </div>
  );
}

function customField(item: NonNullable<DefectsWorkspaceState['detail']>, names: string[]): string | null {
  const entry = Object.entries(item.customFields).find(([key]) =>
    names.some((name) => key.toLowerCase().includes(name)),
  )?.[1];
  if (entry == null) return null;
  if (Array.isArray(entry)) return entry.map(String).join(', ');
  return typeof entry === 'object' ? JSON.stringify(entry) : String(entry);
}

export function DefectDetailPanel({ w }: { w: DefectsWorkspaceState }) {
  const [pendingState, setPendingState] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (!w.selectedId) {
    return (
      <GlassCard title="Work Item Detail" description="Select a row to view details">
        <p className="text-sm text-muted-foreground py-12 text-center">
          Choose a work item to view provider-neutral fields, comments, history, and supported actions.
        </p>
      </GlassCard>
    );
  }

  if (w.detailLoading && !w.detail) {
    return (
      <div className="space-y-4" aria-label="Loading work item detail">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const item = w.detail;
  if (!item) {
    return (
      <GlassCard title="Work Item Detail">
        <p role="alert" className="text-sm text-muted-foreground py-8 text-center">
          Could not load work item {w.selectedId}.
        </p>
      </GlassCard>
    );
  }

  const handleConfirmState = async () => {
    if (!pendingState) return;
    setStateError(null);
    try {
      await w.updateStatus(pendingState);
      setPendingState(null);
    } catch (updateError) {
      setStateError(updateError instanceof Error ? updateError.message : 'Failed to update status');
    }
  };

  const displayState = pendingState ?? item.state.name;
  const stateOptions = [
    item.state,
    ...w.states.filter((state) => state.name !== item.state.name),
  ];
  const components = customField(item, ['component']);
  const sprint = customField(item, ['sprint']);

  const statusControls = (
    <div className="inline-flex flex-col gap-2 w-fit shrink-0 max-w-full">
      <Button variant="outline" size="sm" asChild className="w-full">
        <a href={item.externalUrl ?? item.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-4 h-4 mr-2" />
          Open in {providerLabel(w.provider)}
        </a>
      </Button>
      {w.operations.edit && (
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Edit3 className="w-4 h-4 mr-2" />
          Edit
        </Button>
      )}
      {w.operations.transitionState ? (
        <div className="space-y-1.5 w-full">
          <p className="text-xs font-medium text-muted-foreground">Workflow state</p>
          <UiSelect
            value={displayState}
            onValueChange={(next) => {
              setStateError(null);
              setPendingState(next === item.state.name ? null : next);
            }}
            disabled={w.statusUpdating}
          >
            <SelectTrigger
              className={cn(
                'h-9 text-sm w-full min-w-0 shadow-sm transition-colors',
                workItemStatusSelectClass(displayState),
              )}
              aria-label="Workflow state"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stateOptions.map((state) => (
                <SelectItem
                  key={state.id || state.name}
                  value={state.name}
                  className={workItemStatusItemClass(state.name)}
                >
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </UiSelect>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">State transitions are not supported by this connection.</p>
      )}
      {pendingState && pendingState !== item.state.name && (
        <ConfirmBanner
          title="Confirm state transition"
          message={`Change ${item.id} from "${item.state.name}" to "${pendingState}"?`}
          confirmLabel="Update state"
          loading={w.statusUpdating}
          onConfirm={() => void handleConfirmState()}
          onCancel={() => {
            setPendingState(null);
            setStateError(null);
          }}
        />
      )}
      {stateError && <p role="alert" className="text-xs text-destructive">{stateError}</p>}
      {w.sectionErrors.states && <p role="alert" className="text-xs text-destructive">{w.sectionErrors.states}</p>}
    </div>
  );

  return (
    <div className="space-y-4 lg:sticky lg:top-4">
      <GlassCard
        headerAction={statusControls}
        contentClassName="pt-2"
        title={
          <div className="min-w-0 space-y-1.5 pr-2">
            <p className="text-xs font-medium text-muted-foreground">
              {item.id} — {item.type}
              <span className="text-muted-foreground/80"> · {item.project.name}</span>
            </p>
            <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={item.state.name} className={workItemStatusBadgeClass(item.state.name)} />
              {item.severity && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground">
                  {item.severity}
                </span>
              )}
              {item.priority != null && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground">
                  P{item.priority}
                </span>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Assigned to</dt>
              <dd className="truncate">{item.assignee?.displayName ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Area / component</dt>
              <dd className="truncate">{item.areaPath ?? components ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Iteration / sprint</dt>
              <dd className="truncate">{item.iterationPath ?? sprint ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last changed</dt>
              <dd>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}</dd>
            </div>
          </dl>

          {w.operations.readHistory ? (
            <>
              {w.sectionErrors.history && <InlineAlert variant="warning">{w.sectionErrors.history}</InlineAlert>}
              <DefectHistoryTimeline events={w.history} loading={w.detailLoading} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
              History is not supported by this connection.
            </p>
          )}

          {item.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.labels.map((label) => (
                <span key={label} className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                  {label}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-border/40">
            <HtmlField label="Description" html={item.description} />
            <HtmlField label="Repro steps" html={item.reproSteps} />
            <HtmlField label="Acceptance criteria" html={item.acceptanceCriteria} />
          </div>

          {item.relations.length > 0 && (
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs font-medium text-muted-foreground mb-1">Related links</p>
              <ul className="space-y-1">
                {item.relations.map((relation) => (
                  <li key={`${relation.type}-${relation.url}`}>
                    <a
                      href={relation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {relation.title || relation.type}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {w.operations.readSubissues && (
            <DefectSubissuesPanel
              items={w.subissues}
              writable={w.operations.addSubissues}
              mutating={w.mutating}
              error={w.sectionErrors.subissues}
              onSelect={w.selectWorkItem}
              onAdd={w.addSubIssue}
            />
          )}

          {w.operations.readAttachments ? (
            <DefectAttachmentsPanel
              attachments={w.attachments}
              loading={w.detailLoading}
              uploadable={w.operations.uploadAttachments}
              deletable={w.operations.deleteAttachments}
              mutating={w.mutating}
              error={w.sectionErrors.attachments}
              contentPath={(attachmentId) =>
                workItemEndpoint(
                  w.context,
                  item.id,
                  `attachments/${encodeURIComponent(attachmentId)}/content`,
                )}
              onUpload={w.uploadAttachment}
              onDelete={w.deleteAttachment}
            />
          ) : (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
              Attachments are not supported by this connection.
            </p>
          )}

          <div className="pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void w.investigate()}
              loading={w.investigating}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Investigate with AI
            </Button>
            {w.investigation && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <p className="text-xs font-medium text-primary">AI Investigation</p>
                <p className="text-sm whitespace-pre-wrap">{w.investigation.content}</p>
                {w.investigation.reasoning && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">Reasoning</summary>
                    <p className="mt-2 whitespace-pre-wrap">{w.investigation.reasoning}</p>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {w.operations.readComments && (
        <DefectCommentsThread
          comments={w.comments}
          loading={w.detailLoading}
          writable={w.operations.addComments}
          mutating={w.mutating}
          error={w.sectionErrors.comments}
          onAdd={w.addComment}
        />
      )}
      {w.operations.edit && (
        <WorkItemEditorDialog open={editOpen} mode="edit" w={w} onOpenChange={setEditOpen} />
      )}
    </div>
  );
}
