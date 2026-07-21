import { describe, it, expect } from 'vitest';

import type { RailArrivalDTO } from '../../services/martaRail';
import { groupArrivalsByLineDestination } from './groupArrivalsByLineDestination';

function arrival(overrides: Partial<RailArrivalDTO> = {}): RailArrivalDTO {
  return {
    station: 'FIVE POINTS STATION',
    line: 'RED',
    direction: 'N',
    destination: 'North Springs',
    trainId: 'T',
    arrivalTime: 0,
    isRealtime: true,
    ...overrides,
  };
}

describe('groupArrivalsByLineDestination', () => {
  it('returns an empty array for empty input', () => {
    expect(groupArrivalsByLineDestination([])).toEqual([]);
  });

  it('groups arrivals that share line and destination', () => {
    const groups = groupArrivalsByLineDestination([
      arrival({ trainId: 'A' }),
      arrival({ trainId: 'B' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.line).toBe('RED');
    expect(groups[0]?.destination).toBe('North Springs');
    expect(groups[0]?.arrivals.map((a) => a.trainId)).toEqual(['A', 'B']);
  });

  it('separates the two directions of a line (different destinations)', () => {
    const groups = groupArrivalsByLineDestination([
      arrival({ trainId: 'A', direction: 'N', destination: 'North Springs' }),
      arrival({ trainId: 'B', direction: 'S', destination: 'Airport' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.destination)).toEqual(['North Springs', 'Airport']);
  });

  it('separates a short-turn from a full-length train on the same line and direction', () => {
    // Both northbound Red, but different destinations — a rider heading past
    // Lindbergh must not board the short-turn, so these are distinct sections.
    const groups = groupArrivalsByLineDestination([
      arrival({ trainId: 'A', direction: 'N', destination: 'Lindbergh Center' }),
      arrival({ trainId: 'B', direction: 'N', destination: 'North Springs' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.destination)).toEqual(['Lindbergh Center', 'North Springs']);
  });

  it('keeps distinct lines separate even when they share a destination', () => {
    // Red and Gold both terminate at Airport southbound — different lines,
    // different sections, because line is part of the key.
    const groups = groupArrivalsByLineDestination([
      arrival({ trainId: 'A', line: 'RED', direction: 'S', destination: 'Airport' }),
      arrival({ trainId: 'B', line: 'GOLD', direction: 'S', destination: 'Airport' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.line)).toEqual(['RED', 'GOLD']);
  });

  it('preserves first-appearance order across groups and input order within each', () => {
    const groups = groupArrivalsByLineDestination([
      arrival({ trainId: 'T1', line: 'RED', destination: 'North Springs', arrivalTime: 100 }),
      arrival({ trainId: 'T2', line: 'BLUE', destination: 'Indian Creek', arrivalTime: 110 }),
      arrival({ trainId: 'T3', line: 'RED', destination: 'North Springs', arrivalTime: 120 }),
      arrival({ trainId: 'T4', line: 'BLUE', destination: 'Indian Creek', arrivalTime: 130 }),
    ]);
    expect(groups.map((g) => `${g.line} ${g.destination}`)).toEqual([
      'RED North Springs',
      'BLUE Indian Creek',
    ]);
    expect(groups[0]?.arrivals.map((a) => a.trainId)).toEqual(['T1', 'T3']);
    expect(groups[1]?.arrivals.map((a) => a.trainId)).toEqual(['T2', 'T4']);
  });

  it('carries line, direction, and destination from the first arrival in each group', () => {
    const groups = groupArrivalsByLineDestination([
      arrival({ line: 'GOLD', direction: 'N', destination: 'Doraville' }),
    ]);
    expect(groups[0]).toMatchObject({ line: 'GOLD', direction: 'N', destination: 'Doraville' });
  });
});
