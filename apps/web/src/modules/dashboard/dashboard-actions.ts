import { Activity, ArrowLeftRight, CalendarClock, Cloud, Database, Rocket } from 'lucide-react';
import type { QuickActionItem } from '@/components/studio';
import type { AppModule } from '@/lib/auth-utils';

export interface DashboardQuickAction extends QuickActionItem {
  module: AppModule;
}

export const DASHBOARD_QUICK_ACTIONS: DashboardQuickAction[] = [
  {
    label: 'New Deployment',
    description: 'Deploy metadata from a connected Git provider',
    href: '/deployment-center/git',
    module: 'deployment',
    icon: Rocket,
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-500/10 text-blue-400',
  },
  {
    label: 'Create Scratch Org',
    description: 'Provision a fresh Salesforce org',
    href: '/environment-center/create-scratch-org',
    module: 'environment',
    icon: Cloud,
    border: 'border-l-purple-500',
    iconBg: 'bg-purple-500/10 text-purple-400',
  },
  {
    label: 'Scratch Org Automation',
    description: 'Schedule renewals, run them now, and inspect history',
    href: '/environment-center/automation',
    module: 'environment',
    icon: CalendarClock,
    border: 'border-l-cyan-500',
    iconBg: 'bg-cyan-500/10 text-cyan-400',
  },
  {
    label: 'Data Import',
    description: 'Run SFDMU data deployment',
    href: '/data-center?tab=cona',
    module: 'data',
    icon: Database,
    border: 'border-l-green-500',
    iconBg: 'bg-green-500/10 text-green-400',
  },
  {
    label: 'Data Deployment',
    description: 'Compare and deploy data between orgs',
    href: '/data-deploy',
    module: 'data',
    icon: ArrowLeftRight,
    border: 'border-l-indigo-500',
    iconBg: 'bg-indigo-500/10 text-indigo-400',
  },
  {
    label: 'View Reports',
    description: 'Monitoring and throughput',
    href: '/monitoring',
    module: 'monitoring',
    icon: Activity,
    border: 'border-l-orange-500',
    iconBg: 'bg-orange-500/10 text-orange-400',
  },
];
