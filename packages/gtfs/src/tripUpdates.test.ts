import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { decodeTripUpdates } from './tripUpdates';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../sample-data/marta-gtfs-rt-2026-05-22/tu.pb');
const tuBytes = new Uint8Array(readFileSync(fixturePath));

describe('decodeTripUpdates against the 2026-05-22 snapshot', () => {
  it('parses the feed header timestamp', () => {
    const feed = decodeTripUpdates(tuBytes);
    expect(feed.feedTimestamp).toBe(1779468884);
  });

  it('contains 388 trip updates', () => {
    const feed = decodeTripUpdates(tuBytes);
    expect(feed.trips.length).toBe(388);
  });

  it('contains 343 SCHEDULED and 45 CANCELED trips', () => {
    const feed = decodeTripUpdates(tuBytes);
    const counts = feed.trips.reduce<Record<string, number>>((acc, t) => {
      acc[t.scheduleRelationship] = (acc[t.scheduleRelationship] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ SCHEDULED: 343, CANCELED: 45 });
  });

  it('decodes a known SCHEDULED trip with arrival predictions', () => {
    const feed = decodeTripUpdates(tuBytes);
    const trip = feed.trips.find((t) => t.tripId === '10802068');
    expect(trip).toBeDefined();
    if (!trip) return;

    expect(trip.routeId).toBe('116');
    expect(trip.startTime).toBe('12:10:00');
    expect(trip.startDate).toBe('20260522');
    expect(trip.scheduleRelationship).toBe('SCHEDULED');
    expect(trip.vehicleId).toBe('2303');
    expect(trip.vehicleLabel).toBe('1603');

    expect(trip.stopTimeUpdates.length).toBeGreaterThan(0);
    const firstStop = trip.stopTimeUpdates[0];
    expect(firstStop).toBeDefined();
    expect(firstStop?.stopSequence).toBe(53);
    expect(firstStop?.stopId).toBe('134013');
    expect(firstStop?.arrivalTime).toBe(1779467993);
    expect(firstStop?.arrivalScheduledTime).toBe(1779468116);
  });

  it('decodes a known CANCELED trip with every stop SKIPPED and no predictions', () => {
    const feed = decodeTripUpdates(tuBytes);
    const trip = feed.trips.find((t) => t.tripId === '10807633');
    expect(trip).toBeDefined();
    if (!trip) return;

    expect(trip.scheduleRelationship).toBe('CANCELED');
    expect(trip.routeId).toBe('182');
    expect(trip.stopTimeUpdates.length).toBeGreaterThan(0);
    expect(trip.stopTimeUpdates.every((s) => s.scheduleRelationship === 'SKIPPED')).toBe(true);
    expect(trip.stopTimeUpdates.every((s) => s.arrivalTime === undefined)).toBe(true);
    expect(trip.stopTimeUpdates.every((s) => s.departureTime === undefined)).toBe(true);
  });

  it('throws on invalid input', () => {
    expect(() => decodeTripUpdates(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toThrow();
  });
});
