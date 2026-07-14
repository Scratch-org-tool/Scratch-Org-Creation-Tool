'use client';

import Link from 'next/link';
import { Ban, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { relativeTime, statusBadgeClass, statusLabel } from '@/lib/ui-utils';
import { StatusBadge } from './status-badge';

export function ListRowStatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'success')
    return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (s === 'failed' || s === 'paused') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (s === 'cancelled') return <Ban className="w-4 h-4 text-muted-foreground shrink-0" />;
  if (s === 'running' || s === 'pending' || s === 'queued')
    return <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
  return <Loader2 className="w-4 h-4 text-muted-foreground shrink-0" />;
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  status?: string;
  statusLabel?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

export function ListRow({
  title,
  subtitle,
  status,
  statusLabel: customStatusLabel,
  href,
  onClick,
  icon,
  trailing,
  className,
}: ListRowProps) {
  const content = (
    <>
      {icon ?? (status ? <ListRowStatusIcon status={status} /> : null)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {trailing}
      {status && !trailing && (
        <StatusBadge status={status} label={customStatusLabel} />
      )}
    </>
  );

  const rowClass = cn(
    'flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(rowClass, 'w-full text-left')}>
        {content}
      </button>
    );
  }

  return <div className={rowClass}>{content}</div>;
}

interface ListRowGroupProps {
  children: React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  maxHeight?: string;
}

export function ListRowGroup({
  children,
  emptyMessage = 'No items yet.',
  loading,
  maxHeight = '320px',
}: ListRowGroupProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-md bg-secondary/50 animate-pulse" />
        ))}
      </div>
    );
  }

  const childArray = Array.isArray(children) ? children : [children];
  const hasItems = childArray.some((c) => c != null);

  if (!hasItems) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-1 overflow-y-auto scrollbar-thin pr-1" style={{ maxHeight }}>
      {children}
    </div>
  );
}

export { relativeTime, statusBadgeClass, statusLabel };
