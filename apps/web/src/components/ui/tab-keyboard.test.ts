import { describe, expect, it } from 'vitest';
import { nextTabIndex } from './tab-keyboard';

describe('ARIA tab keyboard navigation', () => {
  it('wraps arrow navigation in both directions', () => {
    expect(nextTabIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextTabIndex('ArrowDown', 0, 3)).toBe(1);
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextTabIndex('ArrowUp', 2, 3)).toBe(1);
  });

  it('supports Home and End without intercepting unrelated keys', () => {
    expect(nextTabIndex('Home', 1, 3)).toBe(0);
    expect(nextTabIndex('End', 1, 3)).toBe(2);
    expect(nextTabIndex('Enter', 1, 3)).toBeNull();
  });
});
