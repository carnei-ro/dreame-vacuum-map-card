import { describe, expect, it } from 'vitest';
import { resolveThemeType } from '../utils';

describe('resolveThemeType', () => {
  it('follows Home Assistant dark mode when the theme is omitted or auto', () => {
    expect(resolveThemeType(undefined, true)).toBe('dark');
    expect(resolveThemeType('auto', false)).toBe('light');
  });

  it('keeps an explicit theme', () => {
    expect(resolveThemeType('light', true)).toBe('light');
    expect(resolveThemeType('custom', true)).toBe('custom');
  });
});
