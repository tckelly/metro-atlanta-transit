/**
 * Persistence for the user's theme preference. The storage key is
 * shared with the inline bootstrap script in `index.html`: the script
 * reads it before React mounts so the page paints in the right theme
 * on cold open (no flash-of-wrong-theme). If you change the key here,
 * update the bootstrap too — the test file pins both ends.
 *
 * Storage is injected so tests can use an in-memory stand-in instead
 * of jsdom's shared `window.localStorage`. The hook supplies the real
 * `globalThis.localStorage` at runtime.
 */
import { z } from 'zod';

import type { ThemePreference } from './resolveEffectiveMode';

export const THEME_STORAGE_KEY = 'atl-transit:theme';

const ThemePreferenceSchema = z.enum(['auto', 'light', 'dark']);

/**
 * Minimal subset of the Web Storage API. The bootstrap-side write never
 * happens, so we only need read + write — no `removeItem`. Auto is a
 * real stored value rather than an absent one, for read/write symmetry.
 */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): ThemeStorage {
  return globalThis.localStorage;
}

export function loadThemePreference(
  storage: ThemeStorage = defaultStorage(),
): ThemePreference {
  const raw = storage.getItem(THEME_STORAGE_KEY);
  if (raw === null) return 'auto';

  const result = ThemePreferenceSchema.safeParse(raw);
  if (!result.success) {
    console.warn(
      `[theme] dropping value in ${THEME_STORAGE_KEY} that failed validation:`,
      result.error.issues,
    );
    return 'auto';
  }
  return result.data;
}

export function saveThemePreference(
  preference: ThemePreference,
  storage: ThemeStorage = defaultStorage(),
): void {
  storage.setItem(THEME_STORAGE_KEY, preference);
}
