import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readExportedString(tsPath, exportName) {
  const source = readFileSync(tsPath, 'utf8');
  const marker = `export const ${exportName} = \``;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Missing ${exportName} in ${tsPath}`);
  const contentStart = start + marker.length;
  const contentEnd = source.indexOf('`;', contentStart);
  return source.slice(contentStart, contentEnd);
}

const inlineCssPath = join(__dirname, '../../apps/web/src/lib/chunk-error-inline-css.ts');
const ERROR_PAGE_CSS = readExportedString(inlineCssPath, 'CHUNK_ERROR_INLINE_CSS');
const STATIC_ERROR_BG_HTML = readExportedString(inlineCssPath, 'STATIC_ERROR_BG_HTML');

const SERVER_ERROR_BODY = `
<div class="sfcc-error-page">
  ${STATIC_ERROR_BG_HTML}
  <div class="sfcc-error-overlay" aria-hidden="true"></div>
  <div class="sfcc-error-shell">
    <header class="sfcc-error-brand">
      <img src="/images/logo.png" alt="" width="24" height="24" class="sfcc-error-logo" />
      <span>SF DevOps Command Center</span>
    </header>
    <div class="sfcc-error-content">
      <p class="sfcc-error-code">500</p>
      <h1 class="sfcc-error-title">Something went wrong</h1>
      <p class="sfcc-error-desc">The server couldn’t complete this request.</p>
      <p class="sfcc-error-hint">Try reloading. Your scratch orgs and pipeline history are safe.</p>
      <div class="sfcc-error-actions">
        <a href="/login" class="sfcc-error-btn sfcc-error-btn-primary">Sign in</a>
        <button type="button" class="sfcc-error-btn sfcc-error-btn-secondary" onclick="window.location.reload()">Reload page</button>
        <a href="/dashboard" class="sfcc-error-btn sfcc-error-btn-ghost">Go to Dashboard</a>
      </div>
      <nav class="sfcc-error-quicknav" aria-label="Quick navigation">
        <a href="/environment-center">Environment</a>
        <span aria-hidden="true">·</span>
        <a href="/deployment-center">Deployment</a>
        <span aria-hidden="true">·</span>
        <a href="/data-center">Data</a>
        <span aria-hidden="true">·</span>
        <a href="/monitoring">Monitoring</a>
      </nav>
    </div>
  </div>
</div>`;

/** Standalone branded error page for gateway when the web upstream returns plain 500/502 text. */
export const ERROR_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Something went wrong — SF DevOps Command Center</title>
  <style>${ERROR_PAGE_CSS}</style>
</head>
<body>${SERVER_ERROR_BODY}</body>
</html>`;

export function isPlainErrorBody(body, statusCode) {
  const trimmed = (body ?? '').trim();
  if (statusCode < 500) return false;
  if (!trimmed) return true;
  if (trimmed.length > 300) return false;
  const lower = trimmed.toLowerCase();
  return (
    lower.includes('internal server error') ||
    lower.includes('bad gateway') ||
    lower.includes('service unavailable') ||
    lower.includes('gateway timeout') ||
    lower.includes('upstream') ||
    lower.includes('all upstream servers unavailable')
  );
}
