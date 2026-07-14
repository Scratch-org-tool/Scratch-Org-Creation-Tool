'use client';

import Link from 'next/link';
import { LayoutDashboard, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { DeploymentPageHeader } from '@/components/studio';
import { cn } from '@/utils/cn';
import type { DashboardDays } from './types';

interface DashboardPageHeaderProps {
  displayName?: string;
  role?: string;
  days: DashboardDays;
  onDaysChange: (days: DashboardDays) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function DashboardPageHeader({
  displayName,
  role,
  days,
  onDaysChange,
  onRefresh,
  refreshing,
}: DashboardPageHeaderProps) {
  const welcome = displayName ? `Welcome back, ${displayName}` : 'Welcome back';
  const roleLabel = role ? role.replace(/_/g, ' ') : null;
  const subtitle = roleLabel
    ? `${welcome} · ${roleLabel} · Salesforce DevOps Command Center`
    : `${welcome} · Salesforce DevOps Command Center`;

  return (
    <DeploymentPageHeader
      title="Dashboard"
      subtitle={subtitle}
      icon={LayoutDashboard}
      accentClass="to-blue-500/10"
      actions={
        <>
          <Select
            value={String(days)}
            onChange={(e) => onDaysChange(Number(e.target.value) as DashboardDays)}
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
          <Link
            href="/environment-center/create-scratch-org"
            className={cn(
              'inline-flex items-center justify-center rounded-md font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs',
            )}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Pipeline
          </Link>
        </>
      }
    />
  );
}
