export interface SidebarNavigationInput {
  href: string;
  pathname: string;
  isMobile: boolean;
  closeMobile: () => void;
  startNavigation: (href: string) => void;
  push: (href: string) => void;
}

export function navigateFromSidebar({
  href,
  pathname,
  isMobile,
  closeMobile,
  startNavigation,
  push,
}: SidebarNavigationInput): void {
  if (isMobile) closeMobile();
  if (href === pathname) return;
  startNavigation(href);
  push(href);
}
