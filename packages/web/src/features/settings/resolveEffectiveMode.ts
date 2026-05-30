/**
 * Theme preference as stored and as the user selects it. `auto` defers to
 * the OS's `prefers-color-scheme`; `light` / `dark` are explicit overrides.
 */
export type ThemePreference = 'auto' | 'light' | 'dark';

/** The mode the UI actually renders in once `auto` has been resolved. */
export type EffectiveMode = 'light' | 'dark';

/**
 * Map a (preference, OS-prefers-dark) pair to the mode the UI should
 * render. Kept pure so it can be exercised without a DOM / matchMedia
 * stub; the hook (`useThemePreference`) supplies the OS bit at runtime.
 */
export function resolveEffectiveMode(
  preference: ThemePreference,
  osPrefersDark: boolean,
): EffectiveMode {
  if (preference === 'auto') return osPrefersDark ? 'dark' : 'light';
  return preference;
}
