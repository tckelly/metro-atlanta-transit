/**
 * Tests for `useThemePreference`. The hook reads `localStorage` and
 * `window.matchMedia` directly (production reality), so the test file
 * stubs both at the seam: an in-memory localStorage swap and a tiny
 * matchMedia polyfill whose `dark` state can be flipped from the test
 * to simulate the user changing their OS theme. Both stubs are
 * restored in `afterEach` so tests do not leak global mutations.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useThemePreference } from './useThemePreference';
import { THEME_STORAGE_KEY } from './themeStorage';

type ChangeListener = (e: { matches: boolean }) => void;

interface MatchMediaController {
  setDark(value: boolean): void;
  listenerCount(): number;
}

function installMatchMedia(initiallyDark: boolean): MatchMediaController {
  let isDark = initiallyDark;
  const listeners = new Set<ChangeListener>();
  const mql = {
    get matches() {
      return isDark;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: ChangeListener) => listeners.add(fn),
    removeEventListener: (_: string, fn: ChangeListener) => listeners.delete(fn),
  };
  // jsdom doesn't ship matchMedia; assigning here is the canonical stub.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  return {
    setDark(value) {
      isDark = value;
      listeners.forEach((fn) => fn({ matches: value }));
    },
    listenerCount: () => listeners.size,
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  // Drop the matchMedia stub so the next file starts clean.
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useThemePreference', () => {
  it('reads the initial preference from storage on first render', () => {
    installMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const { result } = renderHook(() => useThemePreference());

    expect(result.current.preference).toBe('dark');
  });

  it('applies the resolved mode to <html> on mount (auto + OS dark → .dark)', () => {
    installMatchMedia(true);

    renderHook(() => useThemePreference());

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setPreference("dark") writes storage and adds .dark', () => {
    installMatchMedia(false);

    const { result } = renderHook(() => useThemePreference());
    act(() => {
      result.current.setPreference('dark');
    });

    expect(result.current.preference).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setPreference("light") from auto-dark removes .dark', () => {
    installMatchMedia(true);

    const { result } = renderHook(() => useThemePreference());
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      result.current.setPreference('light');
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reacts to OS preference changes while in auto', () => {
    const media = installMatchMedia(false);

    renderHook(() => useThemePreference());
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => {
      media.setDark(true);
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignores OS preference changes once an explicit mode is chosen', () => {
    const media = installMatchMedia(false);

    const { result } = renderHook(() => useThemePreference());
    act(() => {
      result.current.setPreference('light');
    });

    act(() => {
      media.setDark(true);
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('removes the matchMedia listener on unmount (no leak)', () => {
    const media = installMatchMedia(false);

    const { unmount } = renderHook(() => useThemePreference());
    expect(media.listenerCount()).toBe(1);

    unmount();

    expect(media.listenerCount()).toBe(0);
  });
});
