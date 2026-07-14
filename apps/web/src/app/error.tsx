'use client';

import { AppErrorPage } from '@/components/errors/app-error-page';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorPage error={error} reset={reset} />;
}
