'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogIn, RefreshCw, Rocket } from 'lucide-react';
import { AppLogo } from '@/components/ui/app-logo';
import { Button } from '@/components/ui/button';
import {
  ERROR_PAGE_BRAND,
  ERROR_PAGE_COPY,
  ERROR_PAGE_IMAGE_DESKTOP,
  ERROR_PAGE_IMAGE_MOBILE,
  ERROR_PAGE_NAV,
  type ErrorPageVariant,
} from '@/lib/error-page-content';

export type DeploymentNotFoundVariant = ErrorPageVariant;

interface DeploymentNotFoundProps {
  variant?: DeploymentNotFoundVariant;
  title?: string;
  description?: string;
  reset?: () => void;
}

const QUICK_NAV = [
  ERROR_PAGE_NAV.environment,
  ERROR_PAGE_NAV.deployment,
  ERROR_PAGE_NAV.data,
  ERROR_PAGE_NAV.monitoring,
] as const;

export function DeploymentNotFound({
  variant = 'not-found',
  title,
  description,
  reset,
}: DeploymentNotFoundProps) {
  const router = useRouter();
  const copy = ERROR_PAGE_COPY[variant];
  const showReload =
    variant === 'chunk-error' || variant === 'server-error' || Boolean(reset);

  const handleReload = () => {
    if (reset) {
      reset();
      return;
    }
    window.location.reload();
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0a1628] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* Native img — works when Next/Image optimization is unavailable (error boundaries) */}
        <img
          src={ERROR_PAGE_IMAGE_MOBILE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top sm:hidden"
        />
        <img
          src={ERROR_PAGE_IMAGE_DESKTOP}
          alt=""
          className="absolute inset-0 hidden h-full w-full object-cover object-center sm:block"
        />
        <div className="absolute inset-0 bg-[#0a1628]/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628] via-[#0a1628]/75 to-transparent sm:via-[#0a1628]/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628]/50 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-5 pb-8 pt-6 sm:px-10 sm:pb-12 lg:px-14">
        <header className="flex items-center gap-2 text-white/80">
          <AppLogo size="xs" />
          <span className="text-sm font-medium tracking-tight">{ERROR_PAGE_BRAND}</span>
        </header>

        <div className="mt-auto w-full max-w-lg pt-16 sm:max-w-xl sm:pt-24 lg:max-w-2xl">
          <p className="text-6xl font-bold leading-none tracking-tighter text-white/95 sm:text-7xl lg:text-8xl">
            {copy.code}
          </p>

          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {title ?? copy.title}
          </h1>

          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75 sm:text-base lg:max-w-lg">
            {description ?? copy.description}
          </p>

          <p className="mt-2 max-w-md text-sm text-white/55 sm:text-base lg:max-w-lg">
            {copy.hint}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={ERROR_PAGE_NAV.login.href} className="sm:w-auto">
              <Button size="lg" className="w-full min-w-[140px] gap-2 shadow-lg shadow-primary/20">
                <LogIn className="h-4 w-4" />
                {ERROR_PAGE_NAV.login.label}
              </Button>
            </Link>

            {showReload ? (
              <Button
                size="lg"
                variant="secondary"
                className="w-full min-w-[140px] gap-2 border-white/10 bg-white/10 text-white hover:bg-white/15 sm:w-auto"
                onClick={handleReload}
              >
                <RefreshCw className="h-4 w-4" />
                Reload page
              </Button>
            ) : (
              <Link href={ERROR_PAGE_NAV.dashboard.href} className="sm:w-auto">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full min-w-[140px] gap-2 border-white/10 bg-white/10 text-white hover:bg-white/15"
                >
                  <Rocket className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            )}

            {showReload ? (
              <Link href={ERROR_PAGE_NAV.dashboard.href} className="sm:w-auto">
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full min-w-[140px] gap-2 border border-white/15 bg-transparent text-white/90 hover:bg-white/10 hover:text-white sm:w-auto"
                >
                  {ERROR_PAGE_NAV.dashboard.label}
                </Button>
              </Link>
            ) : (
              <Button
                size="lg"
                variant="ghost"
                className="w-full min-w-[140px] gap-2 border border-white/15 bg-transparent text-white/90 hover:bg-white/10 hover:text-white sm:w-auto"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </Button>
            )}
          </div>

          <nav
            className="mt-8 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-white/10 pt-5 text-sm text-white/50"
            aria-label="Quick navigation"
          >
            {QUICK_NAV.map((link, i) => (
              <span key={link.href} className="inline-flex items-center gap-1">
                {i > 0 && <span className="px-1 select-none" aria-hidden>·</span>}
                <Link href={link.href} className="px-1 py-0.5 transition-colors hover:text-primary">
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
