import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthGuard, ModuleRouteGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { NavigationProvider } from '@/contexts/navigation-context';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ModuleRouteGuard>
        <NavigationProvider>
          <Suspense fallback={null}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </NavigationProvider>
      </ModuleRouteGuard>
    </AuthGuard>
  );
}
