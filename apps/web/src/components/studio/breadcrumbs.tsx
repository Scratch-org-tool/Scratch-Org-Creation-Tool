'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getBreadcrumbs, type BreadcrumbItem } from '@/lib/nav-breadcrumbs';
import { cn } from '@/utils/cn';

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const pathname = usePathname();
  const crumbs = items ?? getBreadcrumbs(pathname);
  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm text-muted-foreground', className)}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={`${crumb.href}-${crumb.label}-${i}`} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />}
            {isLast ? (
              <span className="text-foreground font-medium truncate">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground transition-colors truncate">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
