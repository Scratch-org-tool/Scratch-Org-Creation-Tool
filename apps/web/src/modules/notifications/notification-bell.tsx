'use client';

import { Bell } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useNotifications } from './notifications-context';

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'flex min-w-[1.05rem] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold leading-none text-white',
        className,
      )}
      aria-hidden
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function unreadLabel(count: number): string {
  if (count <= 0) return 'Notifications';
  return `Notifications (${count > 99 ? '99+' : count} unread)`;
}

/**
 * Sidebar footer trigger — matches the surrounding nav buttons and collapses to
 * an icon-only control with an overlaid unread badge.
 */
export function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { unreadCount, open } = useNotifications();

  return (
    <button
      type="button"
      onClick={open}
      title={collapsed ? unreadLabel(unreadCount) : undefined}
      aria-label={unreadLabel(unreadCount)}
      className={cn(
        'group relative flex w-full items-center rounded-xl text-sm font-normal text-white/80 transition-colors hover:bg-white/10',
        collapsed ? 'mx-auto size-10 justify-center p-0' : 'gap-3 px-3 py-2.5',
      )}
    >
      <span className="relative flex shrink-0 items-center justify-center">
        <Bell className="size-[18px]" />
        {collapsed && unreadCount > 0 && (
          <span
            className="absolute -right-1.5 -top-1.5 size-2 rounded-full bg-sky-400 ring-2 ring-[#0a0a0a]"
            aria-hidden
          />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">Notifications</span>
          <UnreadBadge count={unreadCount} className="h-[18px]" />
        </>
      )}
    </button>
  );
}

/** Compact icon trigger for the mobile top bar. */
export function NotificationBellIcon({ className }: { className?: string }) {
  const { unreadCount, open } = useNotifications();

  return (
    <button
      type="button"
      onClick={open}
      aria-label={unreadLabel(unreadCount)}
      className={cn(
        'relative flex size-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white',
        className,
      )}
    >
      <Bell className="size-5" />
      {unreadCount > 0 && (
        <span
          className="absolute right-1 top-1 flex min-w-[1rem] items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-[#0a0a0a]"
          aria-hidden
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
