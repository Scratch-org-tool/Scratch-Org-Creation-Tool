'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Lock, LogOut, PanelLeft } from 'lucide-react';
import { AppLogo } from '@/components/ui/app-logo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';
import { useNavigation } from '@/contexts/navigation-context';
import { useAuth } from '@/contexts/auth-context';
import { canAccessModule } from '@/lib/auth-utils';
import {
  ADMIN_NAV_ITEM,
  APP_NAV,
  avatarColor,
  canAccessNavItem,
  isNavItemActive,
  userInitials,
  type NavItem,
} from '@/lib/app-nav';
import { cn } from '@/utils/cn';
import { openCopilot } from '@/store';

export const SIDEBAR_EXPANDED_PX = 260;
export const SIDEBAR_COLLAPSED_PX = 52;

const EASE = [0.4, 0, 0.2, 1] as const;
const WIDTH_TRANSITION = { duration: 0.28, ease: EASE };
const LABEL_TRANSITION = { duration: 0.2, ease: EASE };

function SidebarBrand({ expanded }: { expanded: boolean }) {
  return (
    <div className={cn('flex items-center min-w-0', expanded ? 'gap-2.5' : 'justify-center w-full')}>
      <AppLogo size="sm" />
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={LABEL_TRANSITION}
            className="min-w-0 overflow-hidden"
          >
            <p className="font-semibold text-sm text-white truncate">SF DevOps</p>
            <p className="text-[11px] text-white/45 truncate">Command Center</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SidebarBrandCompact() {
  return (
    <div className="flex items-center gap-2">
      <AppLogo size="sm" />
    </div>
  );
}

function useSidebarNavigate() {
  const pathname = usePathname();
  const router = useRouter();
  const { startNavigation } = useNavigation();
  const { isMobile, setOpenMobile } = useSidebar();

  return (href: string) => {
    if (isMobile) setOpenMobile(false);
    if (href === pathname) return;
    startNavigation(href);
    router.push(href);
  };
}

function NavTooltip({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: ReactNode;
}) {
  if (!collapsed) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="bg-[#2a2a2a] text-white border-white/10">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavButton({
  label,
  icon: Icon,
  active,
  disabled,
  collapsed,
  locked,
  onClick,
  accent,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  collapsed: boolean;
  locked?: boolean;
  onClick?: () => void;
  accent?: 'purple';
}) {
  const button = (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group flex w-full items-center rounded-xl text-sm font-normal transition-colors',
        collapsed ? 'justify-center size-10 p-0' : 'gap-3 px-3 py-2.5',
        disabled && 'cursor-not-allowed opacity-40',
        !disabled && 'hover:bg-white/10',
        active && 'bg-white/10 text-white',
        !active && !disabled && 'text-white/80',
        accent === 'purple' && !active && 'text-purple-200 hover:bg-purple-500/15',
      )}
    >
      <Icon className={cn('size-[18px] shrink-0', active && 'text-white')} />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={LABEL_TRANSITION}
            className="truncate overflow-hidden whitespace-nowrap flex-1 text-left"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && locked && <Lock className="size-3.5 ml-auto shrink-0 opacity-50" />}
    </button>
  );

  return (
    <NavTooltip label={label} collapsed={collapsed}>
      {button}
    </NavTooltip>
  );
}

function NavEntry({
  item,
  allowed,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  allowed: boolean;
  active: boolean;
  collapsed: boolean;
  onNavigate: (href: string) => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-0.5">
      <NavButton
        label={item.label}
        icon={item.icon}
        active={active}
        disabled={!allowed}
        locked={!allowed}
        collapsed={collapsed}
        onClick={() => allowed && onNavigate(item.href)}
      />
      {item.children && active && !collapsed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="ml-3 flex flex-col gap-0.5 border-l border-white/10 pl-3 overflow-hidden"
        >
          {item.children.map((child) => {
            const childActive =
              pathname === child.href || pathname.startsWith(`${child.href}/`);
            return (
              <button
                key={child.href}
                type="button"
                onClick={() => onNavigate(child.href)}
                className={cn(
                  'rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/10',
                  childActive ? 'text-white font-medium' : 'text-white/55',
                )}
              >
                {child.label}
              </button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

function SidebarPanel({
  expanded,
  onSignOut,
  onToggle,
  showToggle = true,
}: {
  expanded: boolean;
  onSignOut: () => void;
  onToggle?: () => void;
  showToggle?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading, user } = useAuth();
  const navigate = useSidebarNavigate();
  const { isMobile, setOpenMobile } = useSidebar();

  const displayName =
    profile?.displayName ?? user?.displayName ?? user?.email?.split('@')[0] ?? 'User';
  const roleLabel = profile?.role
    ? profile.role.replace(/_/g, ' ')
    : loading
      ? '...'
      : 'user';

  useEffect(() => {
    if (profile?.role === 'admin') {
      router.prefetch('/admin/users');
    }
  }, [profile?.role, router]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col bg-[#0a0a0a] text-white">
        {/* Header */}
        <div
          className={cn(
            'flex shrink-0 items-center pt-3 pb-2',
            expanded ? 'justify-between px-3' : 'flex-col gap-2 px-2',
          )}
        >
          <SidebarBrand expanded={expanded} />
          {showToggle && onToggle && (
            <NavTooltip label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} collapsed={!expanded}>
              <button
                type="button"
                onClick={onToggle}
                className={cn(
                  'flex items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors',
                  expanded ? 'size-9' : 'size-10',
                )}
                aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                <motion.span
                  animate={{ rotate: expanded ? 0 : 180 }}
                  transition={LABEL_TRANSITION}
                >
                  <PanelLeft className="size-[18px]" />
                </motion.span>
              </button>
            </NavTooltip>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 scrollbar-thin">
          <div className="flex flex-col gap-0.5">
            {loading && !profile ? (
              <div className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs text-white/50">
                <Spinner size="sm" />
                {expanded && <span>Loading...</span>}
              </div>
            ) : (
              APP_NAV.map((item) => (
                <NavEntry
                  key={item.href}
                  item={item}
                  allowed={canAccessNavItem(profile, item)}
                  active={isNavItemActive(pathname, item)}
                  collapsed={!expanded}
                  onNavigate={navigate}
                />
              ))
            )}

            {profile?.role === 'admin' && (
              <NavButton
                label={ADMIN_NAV_ITEM.label}
                icon={ADMIN_NAV_ITEM.icon}
                active={pathname.startsWith('/admin')}
                collapsed={!expanded}
                onClick={() => navigate(ADMIN_NAV_ITEM.href)}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-0.5">
            <NavButton
              label="AI Copilot"
              icon={Bot}
              collapsed={!expanded}
              disabled={!canAccessModule(profile, 'copilot')}
              locked={!canAccessModule(profile, 'copilot')}
              accent="purple"
              onClick={() => {
                if (!canAccessModule(profile, 'copilot')) return;
                openCopilot();
                if (isMobile) setOpenMobile(false);
              }}
            />

            <NavTooltip
              label={`${displayName} · ${roleLabel}`}
              collapsed={!expanded}
            >
              <div
                className={cn(
                  'flex items-center rounded-xl transition-colors hover:bg-white/10',
                  expanded ? 'gap-3 px-3 py-2.5' : 'justify-center size-10 mx-auto',
                )}
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback
                    className={cn('text-xs font-medium text-white', avatarColor(displayName))}
                  >
                    {userInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={LABEL_TRANSITION}
                      className="min-w-0 flex-1 overflow-hidden"
                    >
                      <p className="truncate text-sm font-medium text-white">{displayName}</p>
                      <p className="truncate text-xs capitalize text-white/45">{roleLabel}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </NavTooltip>

            <NavButton
              label="Log out"
              icon={LogOut}
              collapsed={!expanded}
              onClick={onSignOut}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function AppSidebar({ onSignOut }: { onSignOut: () => void }) {
  const { open, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className="w-[min(260px,85vw)] max-w-[85vw] border-r border-white/10 bg-[#0a0a0a] p-0 text-white [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Application menu</SheetDescription>
          </SheetHeader>
          <SidebarPanel expanded onSignOut={onSignOut} showToggle={false} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? SIDEBAR_EXPANDED_PX : SIDEBAR_COLLAPSED_PX }}
      transition={WIDTH_TRANSITION}
      className="relative z-20 flex h-svh shrink-0 flex-col overflow-hidden border-r border-white/8 bg-[#0a0a0a]"
    >
      <SidebarPanel
        expanded={open}
        onSignOut={onSignOut}
        onToggle={toggleSidebar}
      />
    </motion.aside>
  );
}
