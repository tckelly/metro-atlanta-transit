import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { handleTripStops } from './trip-stops.js';
import { buildGtfsSqlite } from '../../src/buildtime/buildGtfsSqlite.js';
import type { GtfsBundle } from '../../src/buildtime/preprocessGtfs.js';

const BUNDLE: GtfsBundle = {
  stops: [
    { stopId: 'S1', name: 'A', lat: 0, lng: 0, routeIds: ['R1'], directions: [] },
    { stopId: 'S2', name: 'B', lat: 0, lng: 0, routeIds: ['R1'], directions: [] },
    { stopId: 'S3', name: 'C', lat: 0, lng: 0, routeIds: ['R1'], directions: [] },
  ],
  routes: [{ routeId: 'R1', shortName: '1', longName: 'One' }],
  trips: [
    { tripId: 'T1', routeId: 'R1', serviceId: 'WK', headsign: 'Decatur' },
  ],
  stopTimes: [
    { tripId: 'T1', stopId: 'S1', stopSequence: 1, arrivalTime: '06:00:00', departureTime: '06:00:00' },
    { tripId: 'T1', stopId: 'S2', stopSequence: 2, arrivalTime: '06:05:00', departureTime: '06:05:00' },
    { tripId: 'T1', stopId: 'S3', stopSequence: 3, arrivalTime: '06:10:00', departureTime: '06:10:00' },
  ],
  calendar: { rules: [], exceptions: [] },
};

function seededDb(): InstanceType<typeof Database> {
  const db = new Database(':memory:');
  buildGtfsSqlite(BUNDLE, db);
  return db;
}

function get(url: string): Request {
  return new Request(`https://example.test${url}`, { method: 'GET' });
}

describe('handleTripStops', () => {
  // 06:00 ET on 2026-05-22 → 2026-05-22T10:00:00Z (DST, UTC-4).
  const T1_06_00_UNIX = Date.UTC(2026, 4, 22, 10, 0, 0) / 1000;

  it('rejects non-GET with 405', async () => {
    const res = await handleTripStops(
      new Request('https://example.test/api/gtfs/trip-stops', { method: 'POST' }),
      seededDb(),
    );
    expect(res.status).toBe(405);
  });

  it('returns 400 when tripId is missing', async () => {
    const res = await handleTripStops(get('/api/gtfs/trip-stops?date=20260522'), seededDb());
    expect(res.status).toBe(400);
  });

  it('returns 400 when date is missing', async () => {
    const res = await handleTripStops(get('/api/gtfs/trip-stops?tripId=T1'), seededDb());
    expect(res.status).toBe(400);
  });

  it('returns 400 when date is not YYYYMMDD', async () => {
    const res = await handleTripStops(
      get('/api/gtfs/trip-stops?tripId=T1&date=2026-05-22'),
      seededDb(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with the trip’s ordered stops + scheduledTime', async () => {
    const res = await handleTripStops(
      get('/api/gtfs/trip-stops?tripId=T1&date=20260522'),
      seededDb(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { stopId: 'S1', stopSequence: 1, scheduledTime: T1_06_00_UNIX },
      { stopId: 'S2', stopSequence: 2, scheduledTime: T1_06_00_UNIX + 5 * 60 },
      { stopId: 'S3', stopSequence: 3, scheduledTime: T1_06_00_UNIX + 10 * 60 },
    ]);
  });

  it('returns 200 with an empty array for an unknown tripId', async () => {
    const res = await handleTripStops(
      get('/api/gtfs/trip-stops?tripId=NOPE&date=20260522'),
      seededDb(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('sets a Cache-Control header with edge cache', async () => {
    const res = await handleTripStops(
      get('/api/gtfs/trip-stops?tripId=T1&date=20260522'),
      seededDb(),
    );
    expect(res.headers.get('Cache-Control') ?? '').toMatch(/s-maxage=\d+/);
  });
});
