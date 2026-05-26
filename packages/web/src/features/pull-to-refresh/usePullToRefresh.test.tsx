/**
 * Behavior tests for the `usePullToRefresh` hook.
 *
 * The hook exposes a `state` and three intent-only handlers
 * (`start(y)`, `move(y)`, `end()`) — no TouchEvent in the surface so
 * tests can drive it without constructing synthetic browser events.
 * The integration layer (the component) bridges TouchEvent to these.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { usePullToRefresh } from './usePullToRefresh';
import { ARMED_THRESHOLD_PX } from './ptrReducer';

describe('usePullToRefresh', () => {
  it('starts idle', () => {
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: async () => {} }),
    );
    expect(result.current.state.kind).toBe('idle');
  });

  it('calls onRefresh when pulled past threshold and released', async () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => result.current.start(0));
    act(() => result.current.move(ARMED_THRESHOLD_PX + 10));
    expect(result.current.state.kind).toBe('armed');
    act(() => result.current.end());

    expect(onRefresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.state.kind).toBe('idle'));
  });

  it('does not call onRefresh when released below the threshold', () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => result.current.start(0));
    act(() => result.current.move(ARMED_THRESHOLD_PX - 10));
    act(() => result.current.end());

    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.state.kind).toBe('idle');
  });

  it('ignores `start` when isAtTop returns false', () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, isAtTop: () => false }),
    );
    act(() => result.current.start(0));
    expect(result.current.state.kind).toBe('idle');
  });

  it('does not re-arm during a refresh in flight', () => {
    let resolveRefresh = (): void => {};
    const onRefresh = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => result.current.start(0));
    act(() => result.current.move(ARMED_THRESHOLD_PX + 20));
    act(() => result.current.end());
    expect(result.current.state.kind).toBe('refreshing');

    // A second touchstart during refreshing should be ignored.
    act(() => result.current.start(0));
    expect(result.current.state.kind).toBe('refreshing');

    act(() => {
      resolveRefresh();
    });
  });

  it('returns to idle even when onRefresh rejects', async () => {
    const onRefresh = vi.fn(async () => {
      throw new Error('refresh failed');
    });
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => result.current.start(0));
    act(() => result.current.move(ARMED_THRESHOLD_PX + 5));
    act(() => result.current.end());

    await waitFor(() => expect(result.current.state.kind).toBe('idle'));
  });
});
