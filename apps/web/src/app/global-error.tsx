'use client';

import { AppErrorPage } from '@/components/errors/app-error-page';
import { CHUNK_ERROR_INLINE_CSS } from '@/lib/chunk-error-inline-css';
import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <style dangerouslySetInnerHTML={{ __html: CHUNK_ERROR_INLINE_CSS }} />
      </head>
      <body className="bg-[#0a1628] text-foreground">
        <AppErrorPage error={error} reset={reset} />
      </body>
    </html>
  );
}
