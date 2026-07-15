import { Activity, Cloud, Database, Rocket } from 'lucide-react';
import type { QuickActionItem } from '@/components/studio';

export const DASHBOARD_QUICK_ACTIONS: QuickActionItem[] = [
  {
    label: 'New Deployment',
    description: 'Deploy metadata from a connected Git provider',
    href: '/deployment-center/git',
    icon: Rocket,
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-500/10 text-blue-400',
  },
  {
    label: 'Create Scratch Org',
    description: 'Provision a fresh Salesforce org',
    href: '/environment-center/create-scratch-org',
    icon: Cloud,
    border: 'border-l-purple-500',
    iconBg: 'bg-purple-500/10 text-purple-400',
  },
  {
    label: 'Data Import',
    description: 'Run SFDMU data deployment',
    href: '/data-center?tab=cona',
    icon: Database,
    border: 'border-l-green-500',
    iconBg: 'bg-green-500/10 text-green-400',
  },
  {
    label: 'Org-to-Org Data',
    description: 'Compare and deploy data between orgs',
    href: '/data-center?tab=org-to-org',
    icon: Database,
    border: 'border-l-indigo-500',
    iconBg: 'bg-indigo-500/10 text-indigo-400',
  },
  {
    label: 'View Reports',
    description: 'Monitoring and throughput',
    href: '/monitoring',
    icon: Activity,
    border: 'border-l-orange-500',
    iconBg: 'bg-orange-500/10 text-orange-400',
  },
];
