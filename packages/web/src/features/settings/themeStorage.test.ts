import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  loadThemePreference,
  saveThemePreference,
  THEME_STORAGE_KEY,
  type ThemeStorage,
} from './themeStorage';

function makeMemoryStorage(seed: Record<string, string> = {}): ThemeStorage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('THEME_STORAGE_KEY', () => {
  // The inline bootstrap script in index.html reads this exact key. If the
  // constant ever drifts, the next cold open would render in the wrong
  // theme until React hydrates and overwrites the class. Lock it in.
  it('matches the contract the index.html bootstrap reads', () => {
    expect(THEME_STORAGE_KEY).toBe('atl-transit:theme');
  });
});

describe('loadThemePreference', () => {
  it('defaults to auto when nothing is stored', () => {
    expect(loadThemePreference(makeMemoryStorage())).toBe('auto');
  });

  it.each(['auto', 'light', 'dark'] as const)('reads %s back verbatim', (value) => {
    const storage = makeMemoryStorage({ [THEME_STORAGE_KEY]: value });
    expect(loadThemePreference(storage)).toBe(value);
  });

  it('defaults to auto and warns when the stored value is unknown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = makeMemoryStorage({ [THEME_STORAGE_KEY]: 'sepia' });

    expect(loadThemePreference(storage)).toBe('auto');
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('saveThemePreference', () => {
  it.each(['auto', 'light', 'dark'] as const)('writes %s verbatim', (value) => {
    const storage = makeMemoryStorage();
    saveThemePreference(value, storage);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe(value);
  });
});
