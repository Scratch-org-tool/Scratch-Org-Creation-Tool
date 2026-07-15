import { describe, expect, it, vi } from 'vitest';
import { navigateFromSidebar } from './sidebar-navigation';

describe('sidebar navigation', () => {
  it('closes the mobile sheet before navigating to Account', () => {
    const calls: string[] = [];
    navigateFromSidebar({
      href: '/account',
      pathname: '/dashboard',
      isMobile: true,
      closeMobile: () => calls.push('close'),
      startNavigation: (href) => calls.push(`start:${href}`),
      push: (href) => calls.push(`push:${href}`),
    });
    expect(calls).toEqual(['close', 'start:/account', 'push:/account']);
  });

  it('still closes mobile navigation when Account is already active', () => {
    const closeMobile = vi.fn();
    const startNavigation = vi.fn();
    const push = vi.fn();
    navigateFromSidebar({
      href: '/account',
      pathname: '/account',
      isMobile: true,
      closeMobile,
      startNavigation,
      push,
    });
    expect(closeMobile).toHaveBeenCalledOnce();
    expect(startNavigation).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('does not close the desktop sidebar', () => {
    const closeMobile = vi.fn();
    navigateFromSidebar({
      href: '/account',
      pathname: '/dashboard',
      isMobile: false,
      closeMobile,
      startNavigation: vi.fn(),
      push: vi.fn(),
    });
    expect(closeMobile).not.toHaveBeenCalled();
  });
});
