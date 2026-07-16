'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, BellOff, CheckCheck, CheckCircle2, Info, XCircle } from 'lucide-react';
import {
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationLevel,
  type NotificationRecord,
} from '@sfcc/shared';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { relativeTime } from '@/lib/ui-utils';
import { cn } from '@/utils/cn';

const LEVEL_ICON: Record<NotificationLevel, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const LEVEL_TONE: Record<NotificationLevel, string> = {
  info: 'text-sky-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: NotificationRecord[];
  unreadCount: number;
  enabled: boolean;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onLoadMore: () => void;
}

function NotificationItem({
  notification,
  onActivate,
}: {
  notification: NotificationRecord;
  onActivate: (notification: NotificationRecord) => void;
}) {
  const Icon = LEVEL_ICON[notification.level] ?? Info;
  const tone = LEVEL_TONE[notification.level] ?? 'text-sky-400';
  const categoryLabel = NOTIFICATION_CATEGORY_LABELS[notification.category] ?? 'System';

  return (
    <button
      type="button"
      onClick={() => onActivate(notification)}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
        notification.read
          ? 'border-white/5 bg-transparent hover:bg-white/5'
          : 'border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', tone)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{notification.title}</p>
          {!notification.read && (
            <span
              className="mt-1 size-2 shrink-0 rounded-full bg-sky-400"
              aria-label="Unread"
            />
          )}
        </div>
        {notification.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
        )}
        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">
          {categoryLabel} <span aria-hidden>·</span> {relativeTime(notification.createdAt)}
        </p>
      </div>
    </button>
  );
}

export function NotificationsSheet({
  open,
  onOpenChange,
  notifications,
  unreadCount,
  enabled,
  loading,
  error,
  hasMore,
  loadingMore,
  onMarkRead,
  onMarkAllRead,
  onLoadMore,
}: NotificationsSheetProps) {
  const router = useRouter();

  const activate = (notification: NotificationRecord) => {
    if (!notification.read) onMarkRead(notification.id);
    if (notification.link) {
      onOpenChange(false);
      router.push(notification.link);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b border-border/60 p-4 text-left">
          <div className="flex items-center justify-between gap-2 pr-8">
            <SheetTitle className="text-base">Notifications</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={onMarkAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          </div>
          <SheetDescription className="text-xs">
            {unreadCount > 0
              ? `${unreadCount} unread ${unreadCount === 1 ? 'alert' : 'alerts'}`
              : 'You are all caught up.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Spinner size="sm" />
              <p className="text-xs">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <BellOff className="size-6 opacity-50" />
              <p className="text-sm font-medium text-foreground/80">No notifications yet</p>
              <p className="max-w-[16rem] text-xs">
                {enabled
                  ? 'Alerts about your deployments, data loads, and jobs will appear here.'
                  : 'Notifications are currently turned off by your administrator.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onActivate={activate}
                />
              ))}
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full text-xs"
                  onClick={onLoadMore}
                  loading={loadingMore}
                >
                  Load older
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
