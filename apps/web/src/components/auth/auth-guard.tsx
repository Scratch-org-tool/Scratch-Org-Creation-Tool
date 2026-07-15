'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { canAccessModule, moduleForPath } from '@/lib/auth-utils';
import { PageLoader } from '@/components/ui/page-loader';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return <PageLoader label="Loading..." fullScreen />;
  }

  if (!user) return null;

  return <>{children}</>;
}

export function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const module = moduleForPath(pathname);
  const orgUsersPath =
    pathname === '/org-setup' ||
    pathname.startsWith('/org-setup/') ||
    pathname === '/user-provisioning' ||
    pathname.startsWith('/user-provisioning/');
  const customSettingsPath =
    pathname === '/custom-settings-load' || pathname.startsWith('/custom-settings-load/');
  const authorized = !profile
    ? false
    : orgUsersPath
      ? canAccessModule(profile, 'org-setup') || canAccessModule(profile, 'provisioning')
      : customSettingsPath
        ? canAccessModule(profile, 'data')
        : !module || canAccessModule(profile, module);

  useEffect(() => {
    if (loading || !user || !profile || authorized) return;
    router.replace('/dashboard?locked=1');
  }, [authorized, loading, user, profile, router]);

  if (loading || (user && !profile)) {
    return <PageLoader label="Checking access..." fullScreen />;
  }
  if (!user || !authorized) return null;
  return <>{children}</>;
}
