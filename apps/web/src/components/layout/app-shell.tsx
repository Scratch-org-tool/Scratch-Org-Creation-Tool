'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import { AppSidebar, SidebarBrandCompact } from '@/components/layout/app-sidebar';
import { SidebarPreferencesSync } from '@/components/layout/sidebar-preferences-sync';
import { SidebarWidthSync } from '@/components/layout/sidebar-width-sync';
import { NavigationProgress } from '@/components/ui/navigation-progress';
import { Button } from '@/components/ui/button';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { openCopilot } from '@/store';
import { useAuth } from '@/contexts/auth-context';
import { canAccessModule } from '@/lib/auth-utils';

const CopilotPanel = dynamic(
  () => import('@/modules/ai-copilot/copilot-panel').then((m) => m.CopilotPanel),
  { ssr: false },
);

function MobileNavCloseOnRouteChange() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return null;
}

function MobileHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/8 bg-[#0a0a0a] px-3 py-2.5 shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="size-9 text-white/80 hover:bg-white/10 hover:text-white"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </Button>
      <SidebarBrandCompact />
    </header>
  );
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, user, signOut, loading, profileError, refreshProfile } = useAuth();
  const canUseCopilot = canAccessModule(profile, 'copilot');

  useEffect(() => {
    if (searchParams.get('copilot') !== 'open' || !canUseCopilot) return;
    openCopilot();
    const next = new URLSearchParams(searchParams.toString());
    next.delete('copilot');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, canUseCopilot, pathname, router]);

  const handleSignOut = () => {
    signOut().then(() => {
      window.location.href = '/login';
    });
  };

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      <AppSidebar onSignOut={handleSignOut} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileHeader />
        <div className="relative flex flex-1 flex-col min-w-0 overflow-hidden">
          <NavigationProgress />
          {user && !profile && !loading && (
            <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
              <span className="text-amber-700 dark:text-amber-300">
                Could not load your access profile.{' '}
                {profileError ? 'Please retry or log out and sign in again.' : ''}
              </span>
              <button
                type="button"
                onClick={() => refreshProfile()}
                className="shrink-0 px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 self-start sm:self-auto"
              >
                Retry
              </button>
            </div>
          )}
          <main className="flex-1 overflow-y-auto scrollbar-thin flex flex-col min-w-0 relative">{children}</main>
        </div>
      </div>
      <MobileNavCloseOnRouteChange />
      <SidebarPreferencesSync />
      <SidebarWidthSync />
      {canUseCopilot && <CopilotPanel />}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      defaultOpen={false}
      className="h-svh overflow-hidden"
      style={
        {
          '--sidebar-width': '16.25rem',
          '--sidebar-width-icon': '3.25rem',
        } as React.CSSProperties
      }
    >
      <AppShellContent>{children}</AppShellContent>
    </SidebarProvider>
  );
}
