'use client';

import { useCallback, useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FileDropzoneProps {
  accept?: string;
  label?: string;
  hint?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function FileDropzone({
  accept = '.json,.xlsx,.xls',
  label = 'Drop file here or click to browse',
  hint,
  file,
  onFileChange,
  disabled,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = useCallback(
    (f: File | null) => {
      if (disabled) return;
      onFileChange(f);
    },
    [disabled, onFileChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f) pick(f);
    },
    [disabled, pick],
  );

  if (file) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5',
          className,
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => pick(null)}
            className="shrink-0 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border/60 bg-card/30 hover:border-primary/40',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <FileUp className="w-8 h-8 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground text-center">{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
