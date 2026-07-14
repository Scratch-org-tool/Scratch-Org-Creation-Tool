'use client';

import { Building2, Cloud, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Input, Label } from '@/components/ui/input';
import { cn } from '@/utils/cn';
import type { OrgConnectType } from './types';
import { LOGIN_URL_PRODUCTION, LOGIN_URL_SANDBOX } from './types';

const TYPES: {
  id: OrgConnectType;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}[] = [
  {
    id: 'production',
    label: 'Production',
    description: 'login.salesforce.com',
    icon: Building2,
    iconClass: 'bg-blue-500/10 text-blue-400',
  },
  {
    id: 'sandbox',
    label: 'Sandbox',
    description: 'test.salesforce.com',
    icon: Cloud,
    iconClass: 'bg-cyan-500/10 text-cyan-400',
  },
  {
    id: 'devhub',
    label: 'Dev Hub',
    description: 'Production + Dev Hub',
    icon: Star,
    iconClass: 'bg-amber-500/10 text-amber-400',
  },
];

interface SalesforceOrgTypeSelectorProps {
  value: OrgConnectType;
  onChange: (type: OrgConnectType) => void;
  disabled?: boolean;
  customUrl: string;
  onCustomUrlChange: (url: string) => void;
}

export function SalesforceOrgTypeSelector({
  value,
  onChange,
  disabled,
  customUrl,
  onCustomUrlChange,
}: SalesforceOrgTypeSelectorProps) {
  const activeLogin =
    value === 'sandbox'
      ? LOGIN_URL_SANDBOX
      : value === 'custom'
        ? customUrl
        : LOGIN_URL_PRODUCTION;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Org type</p>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(t.id)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors',
                value === t.id
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border/60 bg-card/30 hover:border-primary/25',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <span className={cn('w-9 h-9 rounded-lg flex items-center justify-center', t.iconClass)}>
                <t.icon className="w-4 h-4" />
              </span>
              <span className="text-xs font-medium">{t.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Login endpoints</p>
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border',
              activeLogin === LOGIN_URL_PRODUCTION
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground',
            )}
            title={LOGIN_URL_PRODUCTION}
          >
            Production · login.salesforce.com
          </span>
          <span
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border',
              activeLogin === LOGIN_URL_SANDBOX
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground',
            )}
            title={LOGIN_URL_SANDBOX}
          >
            Sandbox · test.salesforce.com
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('custom')}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors',
              value === 'custom'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:border-primary/25',
            )}
          >
            Custom URL
          </button>
        </div>
      </div>

      {value === 'custom' && (
        <div>
          <Label>Custom instance URL</Label>
          <Input
            value={customUrl}
            onChange={(e) => onCustomUrlChange(e.target.value)}
            placeholder="https://mydomain.my.salesforce.com"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
