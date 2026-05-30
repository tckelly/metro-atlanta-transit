import { describe, it, expect } from 'vitest';

import { resolveEffectiveMode } from './resolveEffectiveMode';

describe('resolveEffectiveMode', () => {
  it.each([
    // Auto follows the OS preference.
    ['auto', true, 'dark'],
    ['auto', false, 'light'],
    // Explicit preferences win, regardless of OS.
    ['light', true, 'light'],
    ['light', false, 'light'],
    ['dark', true, 'dark'],
    ['dark', false, 'dark'],
  ] as const)(
    'preference=%s, osPrefersDark=%s → %s',
    (preference, osPrefersDark, expected) => {
      expect(resolveEffectiveMode(preference, osPrefersDark)).toBe(expected);
    },
  );
});
