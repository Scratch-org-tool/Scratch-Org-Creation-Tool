import { describe, expect, it } from 'vitest';
import type { UserAccessProfile } from '@/lib/auth-utils';
import {
  APP_NAV,
  canAccessNavChild,
  isNavChildActive,
  isNavItemActive,
  type NavChild,
} from './app-nav';

function profile(overrides: Partial<UserAccessProfile> = {}): UserAccessProfile {
  return {
    id: 'DPT_test',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'user',
    grantedModules: [],
    ...overrides,
  };
}

const deployment = APP_NAV.find((item) => item.href === '/deployment-center');

describe('deployment sidebar navigation', () => {
  it('exposes exactly one deployment top-level entry with a submenu', () => {
    const deploymentItems = APP_NAV.filter(
      (item) =>
        item.href === '/deployment-center' || item.href === '/deployment-workbench',
    );
    expect(deploymentItems).toHaveLength(1);
    expect(deployment).toBeDefined();
    expect(deployment!.children?.length).toBeGreaterThan(0);
  });

  it('folds the workbench into the submenu instead of a duplicate top-level item', () => {
    const childHrefs = deployment!.children!.map((child) => child.href);
    expect(childHrefs).toContain('/deployment-workbench');
    expect(childHrefs).toContain('/deployment-center/git');
    expect(childHrefs).toContain('/metadata-deployment');
    expect(childHrefs).toContain('/deployment-center/automations');
    expect(childHrefs).toContain('/deployment-center/jenkins');
    expect(childHrefs).toContain('/data-center');
    expect(childHrefs).toContain('/data-deploy');
    expect(childHrefs).toContain('/custom-settings-load');
    expect(childHrefs).toContain('/org-setup');
    expect(APP_NAV.some((item) => item.href === '/deployment-workbench')).toBe(false);
  });

  it('has no duplicate child links', () => {
    const hrefs = deployment!.children!.map((child) => child.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('groups every submenu child under a labeled section', () => {
    for (const child of deployment!.children!) {
      expect(child.group, `${child.href} should carry a section group`).toBeTruthy();
    }
    const groups = [...new Set(deployment!.children!.map((child) => child.group))];
    expect(groups).toEqual(['CI/CD', 'Data', 'Org & users']);
  });

  it('keeps the parent active across every deployment sub-route', () => {
    for (const path of [
      '/deployment-center',
      '/deployment-workbench',
      '/deployment-center/git',
      '/deployment-center/automations',
      '/deployment-center/jenkins',
      '/metadata-deployment',
      '/data-center',
      '/data-deploy',
      '/custom-settings-load',
      '/org-setup',
      '/user-provisioning',
    ]) {
      expect(isNavItemActive(path, deployment!)).toBe(true);
    }
  });
});

describe('canAccessNavChild', () => {
  const child = (href: string): NavChild =>
    deployment!.children!.find((c) => c.href === href)!;

  it('gates CI/CD children behind the deployment module', () => {
    const workbench = child('/deployment-workbench');
    expect(canAccessNavChild(profile({ grantedModules: [] }), workbench)).toBe(false);
    expect(canAccessNavChild(profile({ grantedModules: ['deployment'] }), workbench)).toBe(true);
    expect(canAccessNavChild(profile({ role: 'admin' }), workbench)).toBe(true);
  });

  it('shows data children to default users (data is a default module)', () => {
    expect(canAccessNavChild(profile(), child('/data-center'))).toBe(true);
    expect(canAccessNavChild(profile(), child('/data-deploy'))).toBe(true);
  });

  it('shows Org & Users to org-setup OR provisioning users', () => {
    const org = child('/org-setup');
    expect(canAccessNavChild(profile({ grantedModules: ['org-setup'] }), org)).toBe(true);
    expect(canAccessNavChild(profile({ grantedModules: ['provisioning'] }), org)).toBe(true);
    expect(canAccessNavChild(profile({ grantedModules: [] }), org)).toBe(false);
  });

  it('treats a child with no modules as always visible', () => {
    expect(canAccessNavChild(null, { href: '/x', label: 'X' })).toBe(true);
  });
});

describe('isNavChildActive', () => {
  const dataCona: NavChild = {
    href: '/data-center?tab=cona',
    label: 'Data Operations',
    activePrefixes: ['/data-center'],
  };
  const dataOrgToOrg: NavChild = {
    href: '/data-center?tab=org-to-org',
    label: 'Org-to-Org Data Deploy',
    activePrefixes: ['/data-center'],
  };

  it('distinguishes sibling tabs by query param', () => {
    expect(isNavChildActive('/data-center', 'tab=cona', dataCona)).toBe(true);
    expect(isNavChildActive('/data-center', 'tab=cona', dataOrgToOrg)).toBe(false);
    expect(isNavChildActive('/data-center', 'tab=org-to-org', dataOrgToOrg)).toBe(true);
  });

  it('does not activate a tab child on the bare route without the tab', () => {
    expect(isNavChildActive('/data-center', '', dataCona)).toBe(false);
  });

  it('matches plain path children and their sub-paths', () => {
    const workbench: NavChild = { href: '/deployment-workbench', label: 'Deployment Workbench' };
    expect(isNavChildActive('/deployment-workbench', '', workbench)).toBe(true);
    expect(isNavChildActive('/deployment-workbench/anything', '', workbench)).toBe(true);
    expect(isNavChildActive('/metadata-deployment', '', workbench)).toBe(false);
  });

  it('matches via activePrefixes', () => {
    const git: NavChild = {
      href: '/deployment-center/git',
      label: 'Git Metadata Deploy',
      activePrefixes: ['/deployment-center/git', '/deployment-center/azure'],
    };
    expect(isNavChildActive('/deployment-center/azure', '', git)).toBe(true);
    expect(isNavChildActive('/deployment-center/jenkins', '', git)).toBe(false);
  });
});
