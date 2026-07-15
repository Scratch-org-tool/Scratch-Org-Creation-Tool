'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** Main app routes — prefetched after mount so menu clicks load JS chunks from cache. */
const PREFETCH_ROUTES = [
  '/account',
  '/dashboard',
  '/environment-center',
  '/environment-center/create-scratch-org',
  '/scratch-templates',
  '/deployment-center',
  '/deployment-workbench',
  '/deployment-center/git',
  '/deployment-center/jenkins',
  '/metadata-deployment',
  '/data-center',
  '/org-setup',
  '/custom-settings-load',
  '/monitoring',
  '/defects-command-centre',
  '/admin/users',
] as const;

interface NavigationContextValue {
  pendingHref: string | null;
  startNavigation: (href: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    for (const href of PREFETCH_ROUTES) {
      router.prefetch(href);
    }
  }, [router]);

  const startNavigation = useCallback((href: string) => {
    setPendingHref(href);
    router.prefetch(href);
  }, [router]);

  const value = useMemo(
    () => ({ pendingHref, startNavigation }),
    [pendingHref, startNavigation],
  );

  return (
    <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return ctx;
}
