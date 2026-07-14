'use client';

import { DevopsCloudLoader } from '@/components/ui/devops-cloud-loader';
import { cn } from '@/utils/cn';

interface PageLoaderProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

function LoaderBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(199_89%_48%_/0.08),transparent_65%)]" />
        <div className="absolute -left-1/4 top-1/3 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-1/4 bottom-1/4 h-28 w-28 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/4 h-2 w-2 -translate-x-8 rounded-full bg-sky-400/40 blur-[1px]" />
        <div className="absolute right-1/3 top-1/2 h-1.5 w-1.5 rounded-full bg-pink-400/50 blur-[1px]" />
        <div className="absolute left-1/3 bottom-1/3 h-2 w-2 rounded-full bg-cyan-400/35 blur-[1px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center gap-4">
        {children}
      </div>
    </div>
  );
}

export function PageLoader({
  label = 'Loading...',
  className,
  fullScreen = false,
}: PageLoaderProps) {
  const content = (
    <>
      <DevopsCloudLoader size="lg" label={label} />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </>
  );

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-muted-foreground',
        fullScreen ? 'h-screen w-full' : 'min-h-[200px] w-full py-12',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {fullScreen ? (
        <LoaderBackdrop>{content}</LoaderBackdrop>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4">
          {content}
        </div>
      )}
    </div>
  );
}
