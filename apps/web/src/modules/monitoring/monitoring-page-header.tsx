'use client';

import { Activity } from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { DeploymentPageHeader } from '@/components/studio';
import type { MonitoringDays } from './types';

interface MonitoringPageHeaderProps {
  days: MonitoringDays;
  onDaysChange: (days: MonitoringDays) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function MonitoringPageHeader({
  days,
  onDaysChange,
  onRefresh,
  refreshing,
}: MonitoringPageHeaderProps) {
  return (
    <DeploymentPageHeader
      title="Monitoring"
      subtitle="Real-time job monitoring and status overview"
      icon={Activity}
      accentClass="to-cyan-500/10"
      actions={
        <>
          <Select
            value={String(days)}
            onChange={(e) => onDaysChange(Number(e.target.value) as MonitoringDays)}
            className="h-9 text-sm w-[140px]"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </Select>
          <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </>
      }
    />
  );
}
