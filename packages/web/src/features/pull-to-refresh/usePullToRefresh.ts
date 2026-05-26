/**
 * `usePullToRefresh` — turns intent-only events (start/move/end with
 * y coordinates) into a pull-to-refresh state machine and fires the
 * user-supplied `onRefresh` callback when the gesture arms past the
 * threshold and the user releases.
 *
 * Intent-only handlers (not TouchEvent) keep the hook testable without
 * synthetic browser-event scaffolding. The integration layer (the
 * component) translates TouchEvent → intent.
 *
 * `isAtTop` gates the start of a pull. Defaults to `window.scrollY === 0`
 * so we don't hijack downward swipes when the user is scrolled into
 * the list. Tests can override.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { initialPtrState, ptrReducer, type PtrState } from './ptrReducer';

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  /** Predicate gating the start of a pull. Default: window.scrollY === 0. */
  isAtTop?: () => boolean;
}

export interface UsePullToRefreshResult {
  state: PtrState;
  start: (y: number) => void;
  move: (y: number) => void;
  end: () => void;
}

function defaultIsAtTop(): boolean {
  return typeof window !== 'undefined' && window.scrollY === 0;
}

export function usePullToRefresh(
  options: UsePullToRefreshOptions,
): UsePullToRefreshResult {
  const [state, dispatch] = useReducer(ptrReducer, initialPtrState);
  const { isAtTop = defaultIsAtTop } = options;

  // Capture the latest onRefresh / isAtTop in refs so the effect that
  // fires the refresh only depends on state.kind (the actual trigger),
  // not on the identities of the user's callbacks.
  const onRefreshRef = useRef(options.onRefresh);
  const isAtTopRef = useRef(isAtTop);
  useEffect(() => {
    onRefreshRef.current = options.onRefresh;
    isAtTopRef.current = isAtTop;
  });

  useEffect(() => {
    if (state.kind !== 'refreshing') return;
    let cancelled = false;
    onRefreshRef
      .current()
      .catch(() => {
        // Swallow — the refresh source surfaces its own error UI; the
        // gesture's only job is to fire the callback and reset.
      })
      .finally(() => {
        if (!cancelled) dispatch({ type: 'refreshComplete' });
      });
    return () => {
      cancelled = true;
    };
  }, [state.kind]);

  const start = useCallback((y: number) => {
    if (!isAtTopRef.current()) return;
    dispatch({ type: 'start', y });
  }, []);

  const move = useCallback((y: number) => {
    dispatch({ type: 'move', y });
  }, []);

  const end = useCallback(() => {
    dispatch({ type: 'end' });
  }, []);

  return { state, start, move, end };
}
