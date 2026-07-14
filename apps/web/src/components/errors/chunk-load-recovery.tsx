'use client';

import { useEffect, useState } from 'react';
import { DeploymentNotFound } from './deployment-not-found';

function isChunkLoadFailure(message: string, source?: string) {
  if (source?.includes('_next/static')) return true;
  return (
    message.includes('Loading chunk') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('ChunkLoadError') ||
    message.includes('Importing a module script failed')
  );
}

function isServerFailure(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('internal server error') ||
    lower.includes('server error') ||
    lower.includes('status code 500') ||
    lower.includes('http 500')
  );
}

export function ChunkLoadRecovery() {
  const [failed, setFailed] = useState<'chunk-error' | 'server-error' | null>(null);

  useEffect(() => {
    if (document.documentElement.classList.contains('chunk-load-failed')) {
      setFailed('chunk-error');
    } else if (document.documentElement.classList.contains('server-error-failed')) {
      setFailed('server-error');
    }

    const onError = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'SCRIPT') {
        const src = (target as HTMLScriptElement).src;
        if (src.includes('_next/static')) {
          setFailed('chunk-error');
        }
      }
    };

    const onWindowError = (event: ErrorEvent) => {
      const message = event.message ?? '';
      if (isChunkLoadFailure(message, event.filename)) {
        setFailed('chunk-error');
        return;
      }
      if (isServerFailure(message)) {
        setFailed('server-error');
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : String(reason ?? '');
      if (isChunkLoadFailure(message)) {
        setFailed('chunk-error');
        return;
      }
      if (isServerFailure(message)) {
        setFailed('server-error');
      }
    };

    window.addEventListener('error', onError, true);
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!failed) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-auto">
      <DeploymentNotFound variant={failed} />
    </div>
  );
}
