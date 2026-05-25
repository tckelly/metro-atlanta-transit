import { describe, it, expect } from 'vitest';

import { getNearbyStops } from './getNearbyStops';
import type { GtfsBundle, StopOut } from '../../buildtime/preprocessGtfs';

function bundleOf(stops: StopOut[]): GtfsBundle {
  return {
    stops,
    routes: [],
    trips: [],
    stopTimes: [],
    calendar: { rules: [], exceptions: [] },
  };
}

// Five stops radiating from Five Points station at known approximate
// offsets. Distances are in straight-line meters at Atlanta's latitude
// (1° lat ≈ 111 km; 1° lng ≈ 92.5 km).
const FIVE_POINTS = { lat: 33.7540, lng: -84.3915 };
const STOPS: StopOut[] = [
  { stopId: 'A', name: '50 m north', lat: 33.7544, lng: -84.3915, routeIds: ['1'] },
  { stopId: 'B', name: '200 m east', lat: 33.7540, lng: -84.3893, routeIds: ['2'] },
  { stopId: 'C', name: '500 m south', lat: 33.7495, lng: -84.3915, routeIds: ['3'] },
  { stopId: 'D', name: '1 km west', lat: 33.7540, lng: -84.4023, routeIds: ['4'] },
  { stopId: 'E', name: '5 km north', lat: 33.7990, lng: -84.3915, routeIds: ['5'] },
];

describe('getNearbyStops', () => {
  it('returns stops sorted by distance ascending', () => {
    const result = getNearbyStops(bundleOf(STOPS), FIVE_POINTS, 5);
    expect(result.map((s) => s.stopId)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('caps the result at `count` entries', () => {
    const result = getNearbyStops(bundleOf(STOPS), FIVE_POINTS, 3);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.stopId)).toEqual(['A', 'B', 'C']);
  });

  it('augments each result with a non-negative distanceMeters', () => {
    const result = getNearbyStops(bundleOf(STOPS), FIVE_POINTS, 5);
    for (const stop of result) {
      expect(stop.distanceMeters).toBeGreaterThanOrEqual(0);
    }
    // Result is sorted ascending, so the distances are too.
    const distances = result.map((s) => s.distanceMeters);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]!);
    }
  });

  it('preserves the original StopOut fields on each result', () => {
    const [closest] = getNearbyStops(bundleOf(STOPS), FIVE_POINTS, 1);
    expect(closest).toMatchObject({
      stopId: 'A',
      name: '50 m north',
      lat: 33.7544,
      lng: -84.3915,
      routeIds: ['1'],
    });
  });

  it('returns an empty array when the bundle has no stops', () => {
    expect(getNearbyStops(bundleOf([]), FIVE_POINTS, 5)).toEqual([]);
  });

  it('returns an empty array when count is 0', () => {
    expect(getNearbyStops(bundleOf(STOPS), FIVE_POINTS, 0)).toEqual([]);
  });

  it('clamps a negative count to 0', () => {
    expect(getNearbyStops(bundleOf(STOPS), FIVE_POINTS, -2)).toEqual([]);
  });
});
