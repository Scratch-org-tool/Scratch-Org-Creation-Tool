'use client';

import { useEffect } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { SIDEBAR_COLLAPSED_PX, SIDEBAR_EXPANDED_PX } from '@/components/layout/app-sidebar';

/** Keeps --sidebar-width in sync with collapse state for fixed footers (md+ only). */
export function SidebarWidthSync() {
  const { open, isMobile } = useSidebar();

  useEffect(() => {
    const width = isMobile ? '0px' : open ? `${SIDEBAR_EXPANDED_PX}px` : `${SIDEBAR_COLLAPSED_PX}px`;
    document.documentElement.style.setProperty('--sidebar-width', width);
    return () => {
      document.documentElement.style.removeProperty('--sidebar-width');
    };
  }, [open, isMobile]);

  return null;
}
