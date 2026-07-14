import type { ErrorPageVariant } from '@/lib/error-page-content';

export function resolveErrorVariant(error: Error & { digest?: string }): ErrorPageVariant {
  const message = (error.message ?? '').toLowerCase();

  if (
    message.includes('loading chunk') ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('chunkloaderror') ||
    message.includes('importing a module script failed')
  ) {
    return 'chunk-error';
  }

  if (
    message.includes('internal server error') ||
    message.includes('server error') ||
    message.includes('status code 500') ||
    message.includes('http 500') ||
    message.includes('unexpected response') ||
    Boolean(error.digest)
  ) {
    return 'server-error';
  }

  return 'runtime-error';
}
