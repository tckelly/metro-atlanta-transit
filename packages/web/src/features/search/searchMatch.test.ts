/**
 * Tests for the pure stop-search functions. The two exports are:
 *
 *   - `matchesQuery(name, query)` — boolean predicate used to filter
 *     small, already-loaded lists (a single route's direction).
 *   - `rankStops(stops, query, limit)` — ranks + slices a full corpus
 *     of stops for the global search box.
 *
 * Atlanta stop names follow an intersection convention
 * ("<street> @ <cross-street>"), so the ranking tests use that shape
 * to validate the prefix > word-boundary > anywhere ordering.
 */
import { describe, it, expect } from 'vitest';

import { matchesQuery, rankStops } from './searchMatch';
import type { StopOut } from '../../buildtime/preprocessGtfs';

function stop(id: string, name: string): StopOut {
  return { stopId: id, name, lat: 0, lng: 0, routeIds: [] };
}

describe('matchesQuery', () => {
  it('matches case-insensitively', () => {
    expect(matchesQuery('Ponce de Leon @ Barnett St', 'PONCE')).toBe(true);
    expect(matchesQuery('Ponce de Leon @ Barnett St', 'barnett')).toBe(true);
  });

  it('ignores leading/trailing whitespace in the query', () => {
    expect(matchesQuery('Memorial Dr SE @ Hill St', '  memorial  ')).toBe(true);
  });

  it('returns false for an empty or whitespace-only query', () => {
    expect(matchesQuery('Memorial Dr SE @ Hill St', '')).toBe(false);
    expect(matchesQuery('Memorial Dr SE @ Hill St', '   ')).toBe(false);
  });

  it('returns false when the query is not a substring of the name', () => {
    expect(matchesQuery('Memorial Dr SE @ Hill St', 'peachtree')).toBe(false);
  });
});

describe('rankStops', () => {
  const FIXTURE: StopOut[] = [
    stop('A', 'Cherokee Ave @ Ponce Pl'),       // ponce: word-boundary (after "@ ")
    stop('B', 'Ponce de Leon Ave @ Barnett St'), // ponce: prefix
    stop('C', 'Sponcetown Rd @ Old Mill Ln'),    // ponce: anywhere (inside "Sponcetown")
    stop('D', 'Peachtree St NW @ 14th St'),      // no match
    stop('E', 'Ponce de Leon Ave @ Boulevard'),  // ponce: prefix
  ];

  it('returns an empty list when the query is empty', () => {
    expect(rankStops(FIXTURE, '', 10)).toEqual([]);
    expect(rankStops(FIXTURE, '   ', 10)).toEqual([]);
  });

  it('ranks prefix matches above word-boundary matches above substring matches', () => {
    const ranked = rankStops(FIXTURE, 'ponce', 10);
    expect(ranked.map((s) => s.stopId)).toEqual(['B', 'E', 'A', 'C']);
  });

  it('respects the limit', () => {
    const ranked = rankStops(FIXTURE, 'ponce', 2);
    expect(ranked).toHaveLength(2);
    // Limit slices after ranking, so the top two prefix matches come through.
    expect(ranked.map((s) => s.stopId)).toEqual(['B', 'E']);
  });

  it('matches across the intersection separator', () => {
    // "barnett" appears after "@ " — counts as a word-boundary match.
    const ranked = rankStops(FIXTURE, 'barnett', 10);
    expect(ranked.map((s) => s.stopId)).toEqual(['B']);
  });

  it('preserves source order within the same tier', () => {
    // B and E are both prefix matches; B appears first in the source, so
    // B must rank before E. Determinism matters for keyboard nav.
    const ranked = rankStops(FIXTURE, 'ponce de', 10);
    expect(ranked.map((s) => s.stopId)).toEqual(['B', 'E']);
  });

  it('is case-insensitive', () => {
    const ranked = rankStops(FIXTURE, 'PONCE', 10);
    expect(ranked[0]?.stopId).toBe('B');
  });

  it('returns an empty list when nothing matches', () => {
    expect(rankStops(FIXTURE, 'xyz', 10)).toEqual([]);
  });
});
