import '@testing-library/jest-dom/vitest';

// Initialize i18next with English resources before any test runs.
// Tests that assert on rendered text rely on `t()` resolving
// deterministically — no async loading, no Suspense boundaries.
import './i18n/init';
