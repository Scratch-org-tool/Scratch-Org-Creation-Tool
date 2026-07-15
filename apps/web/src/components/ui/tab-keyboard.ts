export function nextTabIndex(
  key: string,
  currentIndex: number,
  tabCount: number,
): number | null {
  if (tabCount < 1 || currentIndex < 0 || currentIndex >= tabCount) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return tabCount - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (currentIndex + 1) % tabCount;
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (currentIndex - 1 + tabCount) % tabCount;
  }
  return null;
}

export function activateTabFromKey(
  event: React.KeyboardEvent<HTMLElement>,
): void {
  const tabList = event.currentTarget.closest<HTMLElement>('[role="tablist"]');
  if (!tabList) return;
  const tabs = Array.from(
    tabList.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
  );
  const currentIndex = tabs.indexOf(event.currentTarget);
  const nextIndex = nextTabIndex(event.key, currentIndex, tabs.length);
  if (nextIndex === null) return;
  event.preventDefault();
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}
