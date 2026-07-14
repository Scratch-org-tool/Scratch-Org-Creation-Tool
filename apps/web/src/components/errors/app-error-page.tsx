'use client';

import { useEffect } from 'react';
import { DeploymentNotFound } from '@/components/errors/deployment-not-found';
import { resolveErrorVariant } from '@/lib/resolve-error-variant';

interface AppErrorPageProps {
  error: Error & { digest?: string };
  reset?: () => void;
}

export function AppErrorPage({ error, reset }: AppErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <DeploymentNotFound
      variant={resolveErrorVariant(error)}
      reset={reset}
    />
  );
}
