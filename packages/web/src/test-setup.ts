import '@testing-library/jest-dom/vitest';
import 'vitest-axe/extend-expect';
import * as matchers from 'vitest-axe/matchers';
import { expect } from 'vitest';

// Initialize i18next with English resources before any test runs.
// Tests that assert on rendered text rely on `t()` resolving
// deterministically — no async loading, no Suspense boundaries.
import './i18n/init';

// vitest-axe — accessibility scanning matcher (toHaveNoViolations).
//
// Coverage caveat: jsdom does not compute styles, so axe cannot check
// color contrast in this layer. Use the matcher for static a11y
// regressions (ARIA, semantic HTML, labels, landmarks) and rely on a
// real-browser pass (Lighthouse, axe DevTools, or future Playwright +
// @axe-core/playwright) for contrast and focus-order verification.
expect.extend(matchers);

// jsdom does not implement `matchMedia`. Provide a benign default so
// components that read `prefers-color-scheme` (e.g. `useThemePreference`)
// don't crash in tests that don't care about theme behavior. Tests that
// do care install their own stub on top — see `useThemePreference.test.ts`.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
