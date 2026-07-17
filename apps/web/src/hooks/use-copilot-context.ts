'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  getEffectiveModules,
  getPageTitleForPath,
  moduleForPath,
  type AppModule,
  type CopilotClientContext,
} from '@sfcc/shared';
import { useAuth } from '@/contexts/auth-context';
import { useOrgs } from '@/hooks/use-orgs';

function resolveModule(pathname: string): AppModule | null {
  const fromMap = moduleForPath(pathname);
  if (fromMap) return fromMap;
  if (pathname.startsWith('/metadata-deployment')) return 'deployment';
  return null;
}

function resolveActiveTab(pathname: string, searchParams: URLSearchParams): string | undefined {
  const tab = searchParams.get('tab');
  if (tab) return tab;
  if (pathname.includes('/azure')) return 'azure';
  if (pathname.includes('/jenkins')) return 'jenkins';
  if (pathname.includes('/create-scratch-org')) return 'create-scratch-org';
  if (pathname === '/environment-center') return 'integrations';
  return undefined;
}

export function useCopilotContext(): CopilotClientContext {
  const pathname = usePathname() ?? '/dashboard';
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { orgs } = useOrgs();

  return useMemo(() => {
    const grantedModules = profile
      ? getEffectiveModules(profile)
      : (['dashboard', 'environment', 'data'] as AppModule[]);

    const connectedOrgs = orgs.map((o) => ({
      alias: o.alias,
      orgId: o.id,
      type: o.type,
    }));

    const jobId = searchParams.get('jobId') ?? searchParams.get('job') ?? undefined;

    return {
      pathname,
      pageTitle: getPageTitleForPath(pathname),
      module: resolveModule(pathname),
      grantedModules,
      connectedOrgs,
      activeTab: resolveActiveTab(pathname, searchParams),
      recentJobId: jobId,
      role: profile?.role === 'admin' ? 'admin' : 'user',
    };
  }, [pathname, searchParams, profile, orgs]);
}
