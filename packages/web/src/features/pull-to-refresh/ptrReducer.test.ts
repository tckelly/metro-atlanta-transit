/**
 * Tests for the pure pull-to-refresh state machine.
 *
 * Keep the reducer free of React, DOM, and timer concerns so it can
 * be exhaustively unit-tested. The hook wraps this with touch event
 * listeners and the on-refresh callback.
 */
import { describe, it, expect } from 'vitest';

import { ptrReducer, initialPtrState, ARMED_THRESHOLD_PX } from './ptrReducer';

describe('ptrReducer', () => {
  it('starts in the idle state', () => {
    expect(initialPtrState).toEqual({ kind: 'idle' });
  });

  it('transitions idle → pulling on start', () => {
    const next = ptrReducer(initialPtrState, { type: 'start', y: 100 });
    expect(next).toEqual({ kind: 'pulling', startY: 100, distance: 0 });
  });

  it('updates distance during pulling', () => {
    const s1 = ptrReducer(initialPtrState, { type: 'start', y: 100 });
    const s2 = ptrReducer(s1, { type: 'move', y: 150 });
    expect(s2.kind).toBe('pulling');
    expect(s2.kind === 'pulling' && s2.distance).toBe(50);
  });

  it('arms when the pull crosses the threshold', () => {
    const s1 = ptrReducer(initialPtrState, { type: 'start', y: 0 });
    const s2 = ptrReducer(s1, { type: 'move', y: ARMED_THRESHOLD_PX + 1 });
    expect(s2.kind).toBe('armed');
  });

  it('disarms back to pulling if the user drags back under the threshold', () => {
    const s1 = ptrReducer(initialPtrState, { type: 'start', y: 0 });
    const s2 = ptrReducer(s1, { type: 'move', y: ARMED_THRESHOLD_PX + 10 });
    expect(s2.kind).toBe('armed');
    const s3 = ptrReducer(s2, { type: 'move', y: ARMED_THRESHOLD_PX - 10 });
    expect(s3.kind).toBe('pulling');
  });

  it('clamps the distance to zero when the user drags upward past the start', () => {
    // A small upward drift shouldn't push distance negative — distance is
    // a visual offset that we render as a translate; it must stay ≥ 0.
    const s1 = ptrReducer(initialPtrState, { type: 'start', y: 100 });
    const s2 = ptrReducer(s1, { type: 'move', y: 80 });
    expect(s2.kind === 'pulling' && s2.distance).toBe(0);
  });

  it('returns to idle on end when not armed', () => {
    const s1 = ptrReducer(initialPtrState, { type: 'start', y: 0 });
    const s2 = ptrReducer(s1, { type: 'move', y: 20 });
    const s3 = ptrReducer(s2, { type: 'end' });
    expect(s3).toEqual({ kind: 'idle' });
  });

  it('enters refreshing on end when armed', () => {
    const s1 = ptrReducer(initialPtrState, { type: 'start', y: 0 });
    const s2 = ptrReducer(s1, { type: 'move', y: ARMED_THRESHOLD_PX + 20 });
    const s3 = ptrReducer(s2, { type: 'end' });
    expect(s3).toEqual({ kind: 'refreshing' });
  });

  it('returns to idle when the refresh completes', () => {
    const s = ptrReducer({ kind: 'refreshing' }, { type: 'refreshComplete' });
    expect(s).toEqual({ kind: 'idle' });
  });

  it('ignores `start` while refreshing — no double-tracking mid-refresh', () => {
    const refreshing = { kind: 'refreshing' as const };
    expect(ptrReducer(refreshing, { type: 'start', y: 0 })).toBe(refreshing);
  });

  it('ignores `move` from idle (defensive — should not happen in practice)', () => {
    expect(ptrReducer(initialPtrState, { type: 'move', y: 100 })).toBe(initialPtrState);
  });

  it('ignores `end` from idle', () => {
    expect(ptrReducer(initialPtrState, { type: 'end' })).toBe(initialPtrState);
  });

  it('ignores `refreshComplete` outside of refreshing', () => {
    expect(ptrReducer(initialPtrState, { type: 'refreshComplete' })).toBe(initialPtrState);
  });
});
