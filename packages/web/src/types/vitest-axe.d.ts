/**
 * vitest-axe ships type augmentations against the `Vi.Assertion`
 * namespace, but Vitest 2+ exposes matchers on the `'vitest'`
 * module's `Assertion` interface. Bridge them ourselves so
 * `expect(container).toHaveNoViolations()` typechecks.
 */
import 'vitest';

declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
