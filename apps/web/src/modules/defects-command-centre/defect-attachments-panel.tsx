'use client';

import { useState } from 'react';
import { Eye, FileSpreadsheet, FileText, FileType, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AzureWorkItemAttachment } from './types';
import { DefectAttachmentPreview } from './defect-attachment-preview';

interface DefectAttachmentsPanelProps {
  workItemId: number;
  attachments: AzureWorkItemAttachment[];
  loading?: boolean;
  projectQuery: string;
}

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp)$/i.test(lower)) return ImageIcon;
  if (/\.(xlsx?|csv)$/i.test(lower)) return FileSpreadsheet;
  if (/\.(docx?|pdf|txt)$/i.test(lower)) return FileText;
  return FileType;
}

export function DefectAttachmentsPanel({
  workItemId,
  attachments,
  loading,
  projectQuery,
}: DefectAttachmentsPanelProps) {
  const [preview, setPreview] = useState<AzureWorkItemAttachment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (loading) {
    return (
      <div className="pt-2 border-t border-border/40 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Attachments</p>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return null;
  }

  return (
    <>
      <div className="pt-2 border-t border-border/40 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Attachments ({attachments.length})
        </p>
        <ul className="space-y-2">
          {attachments.map((file) => {
            const Icon = fileIcon(file.name);
            return (
              <li
                key={file.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/15 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate" title={file.name}>
                    {file.name}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => {
                    setPreview(file);
                    setPreviewOpen(true);
                  }}
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  View
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <DefectAttachmentPreview
        workItemId={workItemId}
        attachment={preview}
        projectQuery={projectQuery}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreview(null);
        }}
      />
    </>
  );
}
