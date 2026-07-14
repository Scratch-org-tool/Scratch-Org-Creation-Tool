export interface BreadcrumbItem {
  href: string;
  label: string;
}

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/environment-center': 'Integrations',
  '/environment-center/connect': 'Connect Salesforce Org',
  '/environment-center/connect-azure': 'Connect Azure DevOps',
  '/environment-center/create-scratch-org': 'Create Scratch Org',
  '/environment-center/scratch-orgs': 'Scratch Orgs',
  '/environment-center/sandboxes': 'Sandboxes',
  '/environment-center/wizard': 'Wizard',
  '/deployment-center': 'Deployment Center',
  '/deployment-center/azure': 'Azure DevOps',
  '/deployment-center/jenkins': 'Jenkins',
  '/deployment-center/releases': 'Release Manager',
  '/metadata-deployment': 'Metadata Deployment',
  '/data-center': 'Data Operations',
  '/data-center/deployment': 'Data Deployment',
  '/data-center/replication': 'Data Replication',
  '/data-center/templates': 'Query Templates',
  '/scratch-templates': 'Templates',
  '/custom-settings-load': 'Custom Settings Load',
  '/org-setup': 'Org & Users',
  '/user-provisioning': 'User Provisioning',
  '/monitoring': 'Monitoring',
  '/admin/users': 'User Access',
};

const SKIP_ROOTS = new Set(['/dashboard', '/deployment-center', '/environment-center', '/monitoring', '/metadata-deployment']);

function environmentScopedCrumbs(pathname: string): BreadcrumbItem[] | null {
  if (pathname !== '/scratch-templates' && !pathname.startsWith('/scratch-templates/')) {
    return null;
  }

  const leafLabel = ROUTE_LABELS[pathname] ?? 'Templates';

  return [
    { href: '/environment-center', label: 'Environment' },
    { href: pathname, label: leafLabel },
  ];
}

function deploymentScopedCrumbs(pathname: string): BreadcrumbItem[] | null {
  const underData = pathname === '/data-center' || pathname.startsWith('/data-center/');
  const isOrgSetup = pathname === '/org-setup' || pathname.startsWith('/org-setup/');
  const isProvisioning =
    pathname === '/user-provisioning' || pathname.startsWith('/user-provisioning/');

  const isCustomSettings =
    pathname === '/custom-settings-load' || pathname.startsWith('/custom-settings-load/');

  if (!underData && !isOrgSetup && !isProvisioning && !isCustomSettings) return null;

  const leafLabel = ROUTE_LABELS[pathname];
  if (!leafLabel) return null;

  return [
    { href: '/deployment-center', label: 'Deployment Center' },
    { href: pathname, label: leafLabel },
  ];
}

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (SKIP_ROOTS.has(pathname)) return [];

  const envScoped = environmentScopedCrumbs(pathname);
  if (envScoped) return envScoped;

  const scoped = deploymentScopedCrumbs(pathname);
  if (scoped) return scoped;

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];
  let path = '';

  for (const segment of segments) {
    path += `/${segment}`;
    const label = ROUTE_LABELS[path];
    if (label) {
      crumbs.push({ href: path, label });
    }
  }

  if (crumbs.length <= 1) return [];
  return crumbs;
}
