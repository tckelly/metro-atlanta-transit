/**
 * Theme preference state for the Settings UI. Reads the saved value
 * from localStorage (under the same key the `index.html` bootstrap
 * script reads), keeps `<html class="dark">` in sync as the user
 * picks Auto / Light / Dark, and — while in Auto — re-reacts when
 * the user changes their OS-level preference.
 *
 * No Context: theme has exactly one React consumer (the Settings
 * radio group). Tailwind's class-based dark mode handles every
 * visual change via CSS, so no component needs to re-render on
 * theme switches. If a second consumer ever appears, promote to
 * Context then — not now.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  resolveEffectiveMode,
  type EffectiveMode,
  type ThemePreference,
} from './resolveEffectiveMode';
import { loadThemePreference, saveThemePreference } from './themeStorage';

const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)';

function applyEffectiveMode(mode: EffectiveMode): void {
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

export interface UseThemePreferenceResult {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

export function useThemePreference(): UseThemePreferenceResult {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    loadThemePreference(),
  );

  // Single place that maps preference + OS bit → DOM class. Runs on
  // mount and whenever preference changes; the bootstrap script has
  // already set the class for the cold-open case, so this is a
  // reconciliation step in the common case.
  useEffect(() => {
    const osPrefersDark = window.matchMedia(PREFERS_DARK_QUERY).matches;
    applyEffectiveMode(resolveEffectiveMode(preference, osPrefersDark));
  }, [preference]);

  // While in Auto, the user flipping their OS theme should propagate.
  // Explicit Light/Dark choices opt out of OS tracking entirely.
  useEffect(() => {
    if (preference !== 'auto') return;
    const mql = window.matchMedia(PREFERS_DARK_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      applyEffectiveMode(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
