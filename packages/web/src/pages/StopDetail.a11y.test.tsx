/**
 * Accessibility scan of the Stop detail page.
 *
 * The arrivals loading skeleton has its own role="status" + sr-only
 * label, the favorite star button is a toggle with aria-pressed, and
 * the back link uses an aria-label. Lots of surface for the broad
 * a11y safety net.
 *
 * Renders the loading state because that's where the dynamic content
 * lives (skeleton + live region). A success-state scan would also be
 * valuable but requires seeding live arrival data — out of scope for
 * this first pass; add when the value is visible.
 */
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { Routes, Route } from 'react-router-dom';

import { StopDetail } from './StopDetail';
import { renderForA11y } from '../test-utils/a11y';

describe('StopDetail — a11y', () => {
  it('passes axe in the loading state', async () => {
    const { container } = renderForA11y(
      <Routes>
        <Route path="/stop/:stopId" element={<StopDetail />} />
      </Routes>,
      { route: '/stop/902990' },
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
