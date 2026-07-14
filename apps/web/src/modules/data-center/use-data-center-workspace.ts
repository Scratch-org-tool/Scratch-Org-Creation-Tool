'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DataCenterTab } from './types';

const VALID_TABS: DataCenterTab[] = ['cona', 'deploy', 'replication', 'templates', 'org-to-org'];

function parseTab(param: string | null): DataCenterTab {
  if (param === 'deploy' || param === 'replication' || param === 'templates' || param === 'org-to-org') {
    return param;
  }
  return 'cona';
}

export function useDataCenterWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));

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
