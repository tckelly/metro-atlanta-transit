/**
 * `moveFavorite` is the pure list operation behind the Reorder favorites UI.
 * It must be deterministic, schema-preserving, and reference-stable on no-op
 * cases so React can short-circuit re-renders (and so callers can detect "the
 * move did nothing" by identity comparison rather than deep equality).
 */
import { describe, it, expect } from 'vitest';

import { moveFavorite } from './reorder';
import type { Favorite } from '../../services/storage';

function favs(...stopIds: string[]): Favorite[] {
  return stopIds.map((stopId, i) => ({ stopId, addedAt: i + 1 }));
}

describe('moveFavorite', () => {
  it('moves the matching stop one position down', () => {
    const before = favs('a', 'b', 'c', 'd');
    const after = moveFavorite(before, 'b', 'down');
    expect(after.map((f) => f.stopId)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('moves the matching stop one position up', () => {
    const before = favs('a', 'b', 'c', 'd');
    const after = moveFavorite(before, 'c', 'up');
    expect(after.map((f) => f.stopId)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('preserves the addedAt of the moved item and its neighbors', () => {
    // Reordering is positional only; the audit timestamps must not change.
    const before = favs('a', 'b', 'c');
    const after = moveFavorite(before, 'a', 'down');
    expect(after).toEqual([
      { stopId: 'b', addedAt: 2 },
      { stopId: 'a', addedAt: 1 },
      { stopId: 'c', addedAt: 3 },
    ]);
  });

  it('returns the same array reference when moving the top item up', () => {
    // Reference stability is the contract: callers (and React) treat
    // identity-equal as "nothing happened" and skip re-renders / writes.
    const before = favs('a', 'b', 'c');
    const after = moveFavorite(before, 'a', 'up');
    expect(after).toBe(before);
  });

  it('returns the same array reference when moving the bottom item down', () => {
    const before = favs('a', 'b', 'c');
    const after = moveFavorite(before, 'c', 'down');
    expect(after).toBe(before);
  });

  it('returns the same array reference when the stopId is not in the list', () => {
    const before = favs('a', 'b', 'c');
    const after = moveFavorite(before, 'missing', 'down');
    expect(after).toBe(before);
  });

  it('returns the same array reference for a single-item list', () => {
    const before = favs('a');
    expect(moveFavorite(before, 'a', 'up')).toBe(before);
    expect(moveFavorite(before, 'a', 'down')).toBe(before);
  });

  it('returns the same array reference for an empty list', () => {
    const before: Favorite[] = [];
    expect(moveFavorite(before, 'a', 'up')).toBe(before);
  });

  it('does not mutate the input array', () => {
    const before = favs('a', 'b', 'c');
    const snapshot = before.map((f) => ({ ...f }));
    moveFavorite(before, 'b', 'down');
    expect(before).toEqual(snapshot);
  });
});
