'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { InlineAlert, QuickActionGrid } from '@/components/studio';
import { DASHBOARD_QUICK_ACTIONS } from '@/modules/dashboard/dashboard-actions';
import { canAccessModule } from '@/lib/auth-utils';
import { DashboardPageHeader } from '@/modules/dashboard/dashboard-page-header';
import { DashboardStatCards } from '@/modules/dashboard/dashboard-stat-cards';
import { DashboardRecentDeployments } from '@/modules/dashboard/dashboard-recent-deployments';
import { DashboardPlatformHealth } from '@/modules/dashboard/dashboard-platform-health';
import { DashboardSummaryDonut } from '@/modules/dashboard/dashboard-summary-donut';
import { useDashboard } from '@/modules/dashboard/use-dashboard';
import type { DashboardDays } from '@/modules/dashboard/types';

export default function DashboardPage() {
  const [days, setDays] = useState<DashboardDays>(7);
  const { data, loading, refreshing, error, refetch } = useDashboard(days);
  const { profile, user } = useAuth();

  const displayName =
    profile?.displayName ?? user?.displayName ?? user?.email?.split('@')[0];
  const quickActions = DASHBOARD_QUICK_ACTIONS.filter((action) =>
    canAccessModule(profile, action.module),
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DashboardPageHeader
        displayName={typeof displayName === 'string' ? displayName : undefined}
        role={profile?.role}
        days={days}
        onDaysChange={setDays}
        onRefresh={() => void refetch()}
        refreshing={refreshing}
        canCreatePipeline={canAccessModule(profile, 'environment')}
      />

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      <DashboardStatCards data={data} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashboardRecentDeployments
          deployments={data?.recentDeployments ?? []}
          loading={loading}
        />
        <DashboardPlatformHealth
          health={data?.health ?? null}
          durationSeries={data?.durationSeries ?? []}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashboardSummaryDonut
          distribution={data?.statusDistribution ?? null}
          loading={loading}
        />
        {quickActions.length > 0 && <QuickActionGrid actions={quickActions} />}
      </div>
    </div>
  );
}
