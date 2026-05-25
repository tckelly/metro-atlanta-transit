/**
 * Accessibility scan of the Settings page.
 *
 * Settings has the most form-like surface in the app — two radio
 * groups with fieldset/legend, a heading hierarchy, and a back link.
 * Static a11y regressions here would land directly on the page users
 * visit when they care about a11y the most.
 */
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';

import { Settings } from './Settings';
import { renderForA11y } from '../test-utils/a11y';

describe('Settings — a11y', () => {
  it('passes axe in its default state', async () => {
    const { container } = renderForA11y(<Settings />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
