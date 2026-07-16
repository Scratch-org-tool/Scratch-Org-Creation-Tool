'use client';

import { useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DataCenterTab } from './types';

const VALID_TABS: DataCenterTab[] = ['cona', 'deploy', 'replication', 'templates'];

function parseTab(param: string | null): DataCenterTab {
  if (param === 'deploy' || param === 'replication' || param === 'templates') {
    return param;
  }
  return 'cona';
}

export function useDataCenterWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = parseTab(tabParam);

  // Org-to-org data deploy moved to its own page; honor old bookmarks/links.
  useEffect(() => {
    if (tabParam === 'org-to-org') router.replace('/data-deploy');
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
