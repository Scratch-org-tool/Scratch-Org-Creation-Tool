import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconClass?: string;
  trend?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, iconClass, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-card/60 p-4 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums">{value}</p>
          {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
        </div>
        {Icon && <Icon className={cn('w-4 h-4 shrink-0', iconClass ?? 'text-primary')} />}
      </div>
    </div>
  );
}

interface StatCardGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
  className?: string;
}

export function StatCardGrid({ children, cols = 4, className }: StatCardGridProps) {
  const colClass =
    cols === 2
      ? 'grid-cols-2'
      : cols === 3
        ? 'grid-cols-2 lg:grid-cols-3'
        : cols === 5
          ? 'grid-cols-2 lg:grid-cols-5'
          : 'grid-cols-2 lg:grid-cols-4';
  return <div className={cn('grid gap-3', colClass, className)}>{children}</div>;
}
