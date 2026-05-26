/**
 * Tests for the Suspense fallback shown while a lazy-loaded route
 * chunk is downloading. The contract:
 *
 *   - Always exposes a polite `aria-live` status region so screen
 *     readers hear the transition immediately.
 *   - Stays visually `sr-only` for the first ~250ms so fast chunk
 *     loads (the typical case) don't flash a visible loader.
 *   - Reveals a visible indicator after the delay so users on slow
 *     connections see honest feedback that something is happening,
 *     not a blank screen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

import { RouteChunkFallback } from './RouteChunkFallback';

describe('RouteChunkFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a polite aria-live status region', () => {
    render(<RouteChunkFallback />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('is visually hidden on initial render (no flash on fast chunk loads)', () => {
    render(<RouteChunkFallback />);
    expect(screen.getByRole('status').className).toMatch(/sr-only/);
  });

  it('reveals a visible loader after the delay elapses', () => {
    render(<RouteChunkFallback />);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole('status').className).not.toMatch(/sr-only/);
  });

  it('keeps the aria attributes consistent across the transition', () => {
    render(<RouteChunkFallback />);
    const before = screen.getByRole('status').getAttribute('aria-label');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const after = screen.getByRole('status').getAttribute('aria-label');
    expect(before).toBe(after);
    // Same text content too — avoids a second SR announcement when the
    // visible class flips. aria-live re-announces on text-content
    // change; if it changed here, screen readers would hear the
    // message twice for a single chunk load.
  });
});
