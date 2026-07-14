import { RouteLoadingShell } from '@/components/ui/route-loading-shell';

export default function Loading() {
  return (
    <RouteLoadingShell
      titleWidth="w-40"
      subtitleWidth="w-64"
      bodyClassName="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[118px] rounded-lg bg-muted/40 animate-pulse" />
      ))}
      <div className="col-span-full grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-80 rounded-xl bg-muted/40 animate-pulse" />
        <div className="h-80 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    </RouteLoadingShell>
  );
}
