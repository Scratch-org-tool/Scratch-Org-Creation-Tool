/** Shared copy for 404 / error pages (React + static HTML fallback). */
import { STATIC_ERROR_BG_HTML } from '@/lib/chunk-error-inline-css';

export const APP_LOGO_SRC = '/images/logo.png';
export const ERROR_PAGE_IMAGE_MOBILE = '/images/deployment-not-found-mobile.png';
export const ERROR_PAGE_IMAGE_DESKTOP = '/images/deployment-not-found-desktop.png';

/** @deprecated Use ERROR_PAGE_IMAGE_MOBILE or ERROR_PAGE_IMAGE_DESKTOP */
export const ERROR_PAGE_IMAGE = ERROR_PAGE_IMAGE_DESKTOP;

export const ERROR_PAGE_BRAND = 'SF DevOps Command Center';

export type ErrorPageVariant = 'not-found' | 'chunk-error' | 'server-error' | 'runtime-error';

export const ERROR_PAGE_COPY: Record<
  ErrorPageVariant,
  { code: string; title: string; description: string; hint: string }
> = {
  'not-found': {
    code: '404',
    title: 'Page not found',
    description: 'This route isn’t part of the current release.',
    hint: 'Check the URL or return to the dashboard to continue.',
  },
  'chunk-error': {
    code: '404',
    title: 'App needs a refresh',
    description:
      'The page tried to load an outdated build — common after a deploy or dev server restart.',
    hint: 'Reload the page or sign in again to fetch the latest version.',
  },
  'server-error': {
    code: '500',
    title: 'Something went wrong',
    description: 'The server couldn’t complete this request.',
    hint: 'Try reloading. Your scratch orgs and pipeline history are safe.',
  },
  'runtime-error': {
    code: 'Error',
    title: 'Something went wrong',
    description: 'This page hit an unexpected error while loading.',
    hint: 'Go back and try again, or check Monitoring for job status.',
  },
};

export const ERROR_PAGE_NAV = {
  login: { href: '/login', label: 'Sign in' },
  dashboard: { href: '/dashboard', label: 'Go to Dashboard' },
  environment: { href: '/environment-center', label: 'Environment' },
  deployment: { href: '/deployment-center', label: 'Deployment' },
  metadata: { href: '/metadata-deployment', label: 'Metadata Deployment' },
  data: { href: '/data-center', label: 'Data' },
  monitoring: { href: '/monitoring', label: 'Monitoring' },
} as const;

const QUICK_NAV_LINKS = [
  ERROR_PAGE_NAV.environment,
  ERROR_PAGE_NAV.deployment,
  ERROR_PAGE_NAV.data,
  ERROR_PAGE_NAV.monitoring,
] as const;

function buildStaticErrorInner(variant: 'chunk-error' | 'server-error') {
  const copy = ERROR_PAGE_COPY[variant];
  const quickNav = QUICK_NAV_LINKS.map(
    (link, i) =>
      `${i > 0 ? '<span aria-hidden="true">·</span>' : ''}<a href="${link.href}">${link.label}</a>`,
  ).join('\n      ');

  return `
<div class="sfcc-error-page">
  ${STATIC_ERROR_BG_HTML}
  <div class="sfcc-error-overlay" aria-hidden="true"></div>
  <div class="sfcc-error-shell">
    <header class="sfcc-error-brand">
      <img src="${APP_LOGO_SRC}" alt="" width="24" height="24" class="sfcc-error-logo" />
      <span>${ERROR_PAGE_BRAND}</span>
    </header>
    <div class="sfcc-error-content">
      <p class="sfcc-error-code">${copy.code}</p>
      <h1 class="sfcc-error-title">${copy.title}</h1>
      <p class="sfcc-error-desc">${copy.description}</p>
      <p class="sfcc-error-hint">${copy.hint}</p>
      <div class="sfcc-error-actions">
        <a href="${ERROR_PAGE_NAV.login.href}" class="sfcc-error-btn sfcc-error-btn-primary">${ERROR_PAGE_NAV.login.label}</a>
        <button type="button" class="sfcc-error-btn sfcc-error-btn-secondary" onclick="window.location.reload()">Reload page</button>
        <a href="${ERROR_PAGE_NAV.dashboard.href}" class="sfcc-error-btn sfcc-error-btn-ghost">${ERROR_PAGE_NAV.dashboard.label}</a>
      </div>
      <nav class="sfcc-error-quicknav" aria-label="Quick navigation">
        ${quickNav}
      </nav>
    </div>
  </div>
</div>`;
}

/** Static HTML for chunk failures before React hydrates. */
export const STATIC_CHUNK_ERROR_HTML = buildStaticErrorInner('chunk-error');

/** Static HTML when Next.js returns a plain-text 500 before React can load. */
export const STATIC_SERVER_ERROR_HTML = buildStaticErrorInner('server-error');
