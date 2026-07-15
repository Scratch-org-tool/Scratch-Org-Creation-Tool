'use client';

import { useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FileType,
  Image as ImageIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineAlert } from '@/components/studio';
import { apiBlob } from '@/services/api';
import type { WorkItemAttachment } from './types';
import { DefectAttachmentPreview } from './defect-attachment-preview';

interface DefectAttachmentsPanelProps {
  attachments: WorkItemAttachment[];
  loading?: boolean;
  uploadable: boolean;
  deletable: boolean;
  mutating: boolean;
  error?: string;
  contentPath: (attachmentId: string) => string;
  onUpload: (file: File) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
}

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp)$/i.test(lower)) return ImageIcon;
  if (/\.(xlsx?|csv)$/i.test(lower)) return FileSpreadsheet;
  if (/\.(docx?|pdf|txt)$/i.test(lower)) return FileText;
  return FileType;
}

function formatSize(size: number | null): string {
  if (size == null) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function DefectAttachmentsPanel({
  attachments,
  loading,
  uploadable,
  deletable,
  mutating,
  error,
  contentPath,
  onUpload,
  onDelete,
}: DefectAttachmentsPanelProps) {
  const [preview, setPreview] = useState<WorkItemAttachment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <div className="pt-2 border-t border-border/40 space-y-2" aria-label="Loading attachments">
        <p className="text-xs font-medium text-muted-foreground">Attachments</p>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setActionError(null);
    try {
      await onUpload(file);
    } catch (uploadError) {
      setActionError(uploadError instanceof Error ? uploadError.message : 'Attachment upload failed');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const download = async (attachment: WorkItemAttachment) => {
    setActionError(null);
    try {
      const blob = await apiBlob(contentPath(attachment.id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setActionError(downloadError instanceof Error ? downloadError.message : 'Attachment download failed');
    }
  };

  return (
    <>
      <div className="pt-2 border-t border-border/40 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Attachments ({attachments.length})
          </p>
          {uploadable && (
            <>
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                onChange={(event) => void upload(event.target.files?.[0])}
                disabled={mutating}
                aria-label="Choose attachment to upload"
              />
              <Button type="button" variant="outline" size="sm" loading={mutating} onClick={() => inputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Upload
              </Button>
            </>
          )}
        </div>
        {(error || actionError) && (
          <InlineAlert variant="warning">{actionError ?? error}</InlineAlert>
        )}
        {attachments.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">No attachments.</p>
        ) : (
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
                    <span className="text-sm truncate" title={file.name}>{file.name}</span>
                    {file.sizeBytes != null && (
                      <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.sizeBytes)}</span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setPreview(file);
                        setPreviewOpen(true);
                      }}
                      aria-label={`Preview ${file.name}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void download(file)}
                      aria-label={`Download ${file.name}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    {deletable && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={mutating}
                        onClick={() => void onDelete(file.id)}
                        aria-label={`Delete ${file.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <DefectAttachmentPreview
        attachment={preview}
        contentPath={preview ? contentPath(preview.id) : ''}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreview(null);
        }}
      />
    </>
  );
}
