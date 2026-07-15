'use client';

import { cn } from '@/utils/cn';

interface IntegrationsDataTableProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export function IntegrationsDataTable({
  children,
  className,
  maxHeight = 'max-h-80',
}: IntegrationsDataTableProps) {
  return (
    <div className={cn('rounded-lg border border-border/60 overflow-hidden', className)}>
      <div className={cn('overflow-auto scrollbar-thin', maxHeight)}>
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function IntegrationsTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border">
      <tr className="text-left text-xs text-muted-foreground">{children}</tr>
    </thead>
  );
}

export function IntegrationsTh({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2.5 font-medium whitespace-nowrap', className)}>{children}</th>;
}

export function IntegrationsTd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2.5 align-middle', className)}>{children}</td>;
}

export function IntegrationsTr({ children, ...props }: React.ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr
      className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
      {...props}
    >
      {children}
    </tr>
  );
}
