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
  const { profile, user } = useAuth();
  const canViewMonitoring = canAccessModule(profile, 'monitoring');
  const canViewEnvironment = canAccessModule(profile, 'environment');
  const canViewDeployment = canAccessModule(profile, 'deployment');
  const { data, loading, refreshing, error, refetch } = useDashboard(
    days,
    canViewMonitoring,
  );

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
        canCreatePipeline={canViewEnvironment}
        showMonitoringControls={canViewMonitoring}
      />

      {canViewMonitoring && error && <InlineAlert variant="error">{error}</InlineAlert>}

      {canViewMonitoring && (
        <>
          <DashboardStatCards
            data={data}
            loading={loading}
            showEnvironment={canViewEnvironment}
            showDeployment={canViewDeployment}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {canViewDeployment && (
              <DashboardRecentDeployments
                deployments={data?.recentDeployments ?? []}
                loading={loading}
              />
            )}
            <DashboardPlatformHealth
              health={data?.health ?? null}
              durationSeries={data?.durationSeries ?? []}
              loading={loading}
              showEnvironment={canViewEnvironment}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DashboardSummaryDonut
              distribution={data?.statusDistribution ?? null}
              loading={loading}
            />
          </div>
        </>
      )}

      {quickActions.length > 0 && (
        <div className="grid grid-cols-1 gap-5">
          <QuickActionGrid actions={quickActions} />
        </div>
      )}

      {!canViewMonitoring && quickActions.length === 0 && (
        <InlineAlert title="Dashboard access is active">
          Additional tools appear here only after an administrator enables them in User Access.
        </InlineAlert>
      )}
    </div>
  );
}
