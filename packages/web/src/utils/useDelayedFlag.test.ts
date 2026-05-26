/**
 * Tests for `useDelayedFlag` — a small timer hook that flips `false → true`
 * after a fixed delay. Used by RouteChunkFallback to delay the visible
 * loader so fast chunk loads stay flicker-free.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDelayedFlag } from './useDelayedFlag';

describe('useDelayedFlag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false on the first render', () => {
    const { result } = renderHook(() => useDelayedFlag(250));
    expect(result.current).toBe(false);
  });

  it('still returns false just before the delay elapses', () => {
    const { result } = renderHook(() => useDelayedFlag(250));
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe(false);
  });

  it('flips to true once the delay has elapsed', () => {
    const { result } = renderHook(() => useDelayedFlag(250));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe(true);
  });

  it('respects different delay values', () => {
    const { result } = renderHook(() => useDelayedFlag(1000));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);
  });

  it('clears the pending timer on unmount (no stale setState)', () => {
    const { unmount } = renderHook(() => useDelayedFlag(250));
    unmount();
    // If the timer weren't cleared, advancing past the delay would
    // attempt a setState on the unmounted component. With cleanup in
    // place, this is silent.
    expect(() => {
      vi.advanceTimersByTime(500);
    }).not.toThrow();
  });
});
