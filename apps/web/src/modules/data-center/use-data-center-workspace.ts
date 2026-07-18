'use client';

import { useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DataCenterTab } from './types';

const VALID_TABS: DataCenterTab[] = [
  'cona',
  'bulk-update',
  'account-partners',
  'replication',
  'templates',
];

function parseTab(param: string | null): DataCenterTab {
  if (
    param === 'bulk-update'
    || param === 'account-partners'
    || param === 'replication'
    || param === 'templates'
  ) {
    return param;
  }
  return 'cona';
}

export function useDataCenterWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = parseTab(tabParam);

  // Org-to-org record deployment (old "org-to-org" and "Generic deploy" tabs)
  // is consolidated into the Deployment Workbench data flow; honor old links.
  useEffect(() => {
    if (tabParam === 'org-to-org' || tabParam === 'deploy') {
      router.replace('/deployment-workbench?flow=data');
    }
  }, [tabParam, router]);

  const setTab = useCallback(
    (tab: DataCenterTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'cona') params.delete('tab');
      else params.set('tab', tab);
      const qs = params.toString();
      router.replace(qs ? `/data-center?${qs}` : '/data-center', { scroll: false });
    },
    [router, searchParams],
  );

  return { activeTab, setTab, validTabs: VALID_TABS };
}
