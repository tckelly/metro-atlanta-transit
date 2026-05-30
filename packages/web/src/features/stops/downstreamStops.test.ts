import { describe, it, expect } from 'vitest';

import { downstreamStops, type TripStop } from './downstreamStops';

const PATTERN: TripStop[] = [
  { stopId: 'A', stopSequence: 1 },
  { stopId: 'B', stopSequence: 2 },
  { stopId: 'C', stopSequence: 3 },
  { stopId: 'D', stopSequence: 4 },
];

describe('downstreamStops', () => {
  it('returns the stops with stopSequence strictly greater than the current sequence', () => {
    expect(downstreamStops(PATTERN, 2)).toEqual([
      { stopId: 'C', stopSequence: 3 },
      { stopId: 'D', stopSequence: 4 },
    ]);
  });

  it('returns empty when the rider is at the last stop on the trip', () => {
    expect(downstreamStops(PATTERN, 4)).toEqual([]);
  });

  it('returns empty when the trip pattern itself is empty', () => {
    expect(downstreamStops([], 1)).toEqual([]);
  });

  it('disambiguates by stopSequence, not stopId — a loop route returns the later occurrence', () => {
    // MARTA doesn't run loops today, but GTFS allows a trip to revisit
    // the same stop_id. Slicing by sequence (not by id-match) means a
    // rider boarding at the second occurrence of stop X gets the post-X
    // tail of the trip, not the first-occurrence tail.
    const loop: TripStop[] = [
      { stopId: 'A', stopSequence: 1 },
      { stopId: 'X', stopSequence: 2 }, // first visit to X
      { stopId: 'B', stopSequence: 3 },
      { stopId: 'X', stopSequence: 4 }, // second visit to X
      { stopId: 'C', stopSequence: 5 },
    ];
    expect(downstreamStops(loop, 4)).toEqual([
      { stopId: 'C', stopSequence: 5 },
    ]);
  });

  it('does not mutate the input pattern', () => {
    const input = [...PATTERN];
    downstreamStops(input, 2);
    expect(input).toEqual(PATTERN);
  });
});
