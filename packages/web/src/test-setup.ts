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

// jsdom doesn't implement window.matchMedia. `useInstallPrompt` reads
// it to detect display-mode: standalone. Stub a non-matching shim so
// the install prompt renders its non-installed path during tests.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
