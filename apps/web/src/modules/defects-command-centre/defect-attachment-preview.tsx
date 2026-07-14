'use client';

import { useEffect, useState } from 'react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { apiBlob } from '@/services/api';
import type { AzureWorkItemAttachment } from './types';

type PreviewMode = 'pdf' | 'image' | 'excel' | 'word' | 'text' | 'unsupported';

interface DefectAttachmentPreviewProps {
  workItemId: number;
  attachment: AzureWorkItemAttachment | null;
  projectQuery: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function detectMode(name: string, contentType: string | null): PreviewMode {
  const lower = name.toLowerCase();
  const type = contentType?.toLowerCase() ?? '';
  if (type.includes('pdf') || lower.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(lower)) return 'image';
  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    type === 'text/csv' ||
    /\.(xlsx?|csv)$/i.test(lower)
  ) {
    return 'excel';
  }
  if (type.includes('wordprocessing') || type.includes('msword') || /\.docx?$/i.test(lower)) {
    return lower.endsWith('.docx') || type.includes('wordprocessing') ? 'word' : 'unsupported';
  }
  if (type.startsWith('text/') || lower.endsWith('.txt')) return 'text';
  return 'unsupported';
}

export function DefectAttachmentPreview({
  workItemId,
  attachment,
  projectQuery,
  open,
  onOpenChange,
}: DefectAttachmentPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [mode, setMode] = useState<PreviewMode>('unsupported');

  useEffect(() => {
    if (!open || !attachment) {
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setError(null);
      setBlobUrl(null);
      setHtmlContent(null);
      setTextContent(null);

      const previewMode = detectMode(attachment.name, attachment.contentType);
      setMode(previewMode);

      try {
        const pq = projectQuery ? `?${projectQuery}` : '';
        const blob = await apiBlob(
          `/defects/work-items/${workItemId}/attachments/${attachment.id}/content${pq}`,
        );
        objectUrl = URL.createObjectURL(blob);
        if (revoked) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        if (previewMode === 'pdf' || previewMode === 'image' || previewMode === 'unsupported') {
          setBlobUrl(objectUrl);
        } else if (previewMode === 'excel') {
          const buffer = await blob.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          if (!firstSheet) {
            setError('Spreadsheet has no sheets.');
            return;
          }
          const sheet = workbook.Sheets[firstSheet];
          const tableHtml = XLSX.utils.sheet_to_html(sheet, { id: 'attachment-preview-table' });
          setHtmlContent(tableHtml);
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        } else if (previewMode === 'word') {
          const buffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          setHtmlContent(result.value);
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        } else if (previewMode === 'text') {
          setTextContent(await blob.text());
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load attachment');
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      } finally {
        setLoading(false);
      }
    };

    void load();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, attachment, workItemId, projectQuery]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto scrollbar-thin">
        <SheetHeader>
          <SheetTitle className="truncate pr-8">{attachment?.name ?? 'Attachment'}</SheetTitle>
          <SheetDescription>Preview attachment without downloading.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 min-h-[50vh]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Loading preview…</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && mode === 'pdf' && blobUrl && (
            <iframe
              src={blobUrl}
              title={attachment?.name}
              className="w-full h-[75vh] rounded-lg border border-border/60 bg-muted/20"
            />
          )}

          {!loading && !error && mode === 'image' && blobUrl && (
            <div className="flex justify-center">
              <img
                src={blobUrl}
                alt={attachment?.name}
                className="max-w-full max-h-[75vh] rounded-lg border border-border/60"
              />
            </div>
          )}

          {!loading && !error && htmlContent && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto scrollbar-thin rounded-lg border border-border/60 p-4 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_th]:border [&_td]:px-2 [&_th]:px-2"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}

          {!loading && !error && textContent && (
            <pre className="text-sm whitespace-pre-wrap break-words rounded-lg border border-border/60 p-4 bg-muted/20 max-h-[75vh] overflow-auto scrollbar-thin">
              {textContent}
            </pre>
          )}

          {!loading && !error && mode === 'unsupported' && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                In-browser preview is not supported for this file type. You can open it in a new tab to view inline.
              </p>
              {blobUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={blobUrl} target="_blank" rel="noopener noreferrer">
                    Open in new tab
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
