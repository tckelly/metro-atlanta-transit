/**
 * Tests for the screen-reader announcement of freshness-tier
 * transitions. The component renders an off-screen `aria-live` region
 * that holds the most recent transition message — empty on mount and
 * silent within a tier. Tier *flips* (fresh ↔ stale, stale ↔ very_stale,
 * recovery to fresh) are the meaningful events that warrant a polite
 * announcement; the per-second / per-15s text updates do not.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LastUpdatedAnnouncement } from './LastUpdatedAnnouncement';

describe('LastUpdatedAnnouncement', () => {
  it('renders a polite aria-live status region', () => {
    render(<LastUpdatedAnnouncement tier="fresh" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('is silent on mount in the fresh tier (the normal state)', () => {
    render(<LastUpdatedAnnouncement tier="fresh" />);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('is silent on mount even when the initial tier is stale (no first-render announcement)', () => {
    // Avoids shouting at the user the instant the page mounts; the
    // visible "Last updated …" text already carries the staleness cue
    // for sighted users, and screen readers will hear the next real
    // transition.
    render(<LastUpdatedAnnouncement tier="stale" />);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('announces when the tier transitions to stale', () => {
    const { rerender } = render(<LastUpdatedAnnouncement tier="fresh" />);
    rerender(<LastUpdatedAnnouncement tier="stale" />);
    expect(screen.getByRole('status').textContent).toMatch(/couldn[’']t refresh/i);
  });

  it('announces when the tier transitions to very_stale', () => {
    const { rerender } = render(<LastUpdatedAnnouncement tier="stale" />);
    rerender(<LastUpdatedAnnouncement tier="very_stale" />);
    expect(screen.getByRole('status').textContent).toMatch(/may be wrong/i);
  });

  it('announces recovery when the tier returns to fresh after being stale', () => {
    const { rerender } = render(<LastUpdatedAnnouncement tier="stale" />);
    // First transition mounts in stale (silent), then to fresh announces recovery.
    rerender(<LastUpdatedAnnouncement tier="fresh" />);
    expect(screen.getByRole('status').textContent).toMatch(/refreshed/i);
  });

  it('stays silent when the tier does not change between renders', () => {
    const { rerender } = render(<LastUpdatedAnnouncement tier="fresh" />);
    rerender(<LastUpdatedAnnouncement tier="fresh" />);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
});
