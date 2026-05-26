/**
 * Pure state machine for the pull-to-refresh gesture.
 *
 * Kept free of React, DOM, and timer concerns so it's exhaustively
 * unit-testable. The `usePullToRefresh` hook wraps this with touch
 * event listeners and the user-supplied refresh callback.
 *
 * States:
 *   - `idle`       — no gesture in progress
 *   - `pulling`    — touch is down, haven't passed the threshold
 *   - `armed`      — pulled past the threshold; release will fire refresh
 *   - `refreshing` — refresh callback in flight
 *
 * Transitions ignore events that don't apply to the current state
 * (defensive: a stray `refreshComplete` outside of `refreshing` is a
 * programming error elsewhere but we'd rather no-op than throw).
 */

export const ARMED_THRESHOLD_PX = 80;

export type PtrState =
  | { kind: 'idle' }
  | { kind: 'pulling'; startY: number; distance: number }
  | { kind: 'armed'; startY: number; distance: number }
  | { kind: 'refreshing' };

export type PtrEvent =
  | { type: 'start'; y: number }
  | { type: 'move'; y: number }
  | { type: 'end' }
  | { type: 'refreshComplete' };

export const initialPtrState: PtrState = { kind: 'idle' };

export function ptrReducer(state: PtrState, event: PtrEvent): PtrState {
  switch (event.type) {
    case 'start':
      if (state.kind !== 'idle') return state;
      return { kind: 'pulling', startY: event.y, distance: 0 };
    case 'move': {
      if (state.kind !== 'pulling' && state.kind !== 'armed') return state;
      const distance = Math.max(0, event.y - state.startY);
      return distance >= ARMED_THRESHOLD_PX
        ? { kind: 'armed', startY: state.startY, distance }
        : { kind: 'pulling', startY: state.startY, distance };
    }
    case 'end':
      if (state.kind === 'armed') return { kind: 'refreshing' };
      if (state.kind === 'pulling') return { kind: 'idle' };
      return state;
    case 'refreshComplete':
      if (state.kind !== 'refreshing') return state;
      return { kind: 'idle' };
  }
}
