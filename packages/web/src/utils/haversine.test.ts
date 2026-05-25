import { describe, it, expect } from 'vitest';

import { haversineMeters } from './haversine';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters({ lat: 33.754, lng: -84.391 }, { lat: 33.754, lng: -84.391 })).toBe(0);
  });

  it('returns ~111195 m for 1° of latitude at the equator', () => {
    // 1° of latitude is essentially 1 minute of arc * 1850 m * 60 ≈ 111 km
    // regardless of longitude. Using the mean Earth radius (6371008.8 m),
    // the exact value is 6371008.8 * π/180 ≈ 111195.0797 m.
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeCloseTo(111195.08, 0); // tolerance: ±1 m
  });

  it('is symmetric: d(A,B) === d(B,A)', () => {
    const a = { lat: 33.7540, lng: -84.3915 }; // Five Points
    const b = { lat: 33.6407, lng: -84.4467 }; // Hartsfield-Jackson area
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });

  it('roughly matches the known ~13 km between Five Points and the airport', () => {
    // Sanity check — Five Points MARTA to ATL airport MARTA is ~13.5 km
    // straight-line. Loose bounds since the station coordinates here are
    // approximate, not pulled from the GTFS feed.
    const fivePoints = { lat: 33.7540, lng: -84.3915 };
    const airport = { lat: 33.6404, lng: -84.4439 };
    const meters = haversineMeters(fivePoints, airport);
    expect(meters).toBeGreaterThan(12500);
    expect(meters).toBeLessThan(14000);
  });

  it('treats small east/west separations correctly at Atlanta latitude', () => {
    // At lat 33.75°, 1° longitude is cos(33.75°) * 111195 ≈ 92450 m.
    const d = haversineMeters({ lat: 33.75, lng: 0 }, { lat: 33.75, lng: 1 });
    expect(d).toBeCloseTo(92450, -1); // ±10 m tolerance
  });

  it('returns a non-negative number for any input', () => {
    const samples: Array<[{ lat: number; lng: number }, { lat: number; lng: number }]> = [
      [{ lat: 90, lng: 0 }, { lat: -90, lng: 0 }],
      [{ lat: 0, lng: 180 }, { lat: 0, lng: -180 }],
      [{ lat: 45, lng: 45 }, { lat: -45, lng: -45 }],
    ];
    for (const [a, b] of samples) {
      expect(haversineMeters(a, b)).toBeGreaterThanOrEqual(0);
    }
  });
});
