import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { handleStopTimes } from './stop-times.js';
import { buildGtfsSqlite } from '../../src/buildtime/buildGtfsSqlite.js';
import type { GtfsBundle } from '../../src/buildtime/preprocessGtfs.js';

const BUNDLE: GtfsBundle = {
  stops: [{ stopId: 'S1', name: 'Test', lat: 0, lng: 0, routeIds: ['R1'], directions: [] }],
  routes: [{ routeId: 'R1', shortName: '1', longName: 'One' }],
  trips: [{ tripId: 'T1', routeId: 'R1', serviceId: 'WK', headsign: 'Decatur' }],
  stopTimes: [
    {
      tripId: 'T1',
      stopId: 'S1',
      stopSequence: 1,
      arrivalTime: '06:00:00',
      departureTime: '06:00:00',
    },
  ],
  calendar: {
    rules: [
      {
        serviceId: 'WK',
        weekdays: [true, true, true, true, true, false, false],
        startDate: '20260101',
        endDate: '20261231',
      },
    ],
    exceptions: [],
  },
};

function seededDb(): InstanceType<typeof Database> {
  const db = new Database(':memory:');
  buildGtfsSqlite(BUNDLE, db);
  return db;
}

function get(url: string): Request {
  return new Request(`https://example.test${url}`, { method: 'GET' });
}

describe('handleStopTimes — method check', () => {
  it('rejects non-GET/HEAD methods with 405', async () => {
    const db = seededDb();
    const res = await handleStopTimes(
      new Request('https://example.test/api/gtfs/stop-times', { method: 'POST' }),
      db,
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toContain('GET');
  });
});

describe('handleStopTimes — param validation', () => {
  it('returns 400 when stopId is missing', async () => {
    const db = seededDb();
    const res = await handleStopTimes(get('/api/gtfs/stop-times?date=20260105'), db);
    expect(res.status).toBe(400);
  });

  it('returns 400 when date is missing', async () => {
    const db = seededDb();
    const res = await handleStopTimes(get('/api/gtfs/stop-times?stopId=S1'), db);
    expect(res.status).toBe(400);
  });

  it('returns 400 when date format is invalid', async () => {
    const db = seededDb();
    const res = await handleStopTimes(
      get('/api/gtfs/stop-times?stopId=S1&date=2026-01-05'),
      db,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when count is not a positive integer', async () => {
    const db = seededDb();
    const res = await handleStopTimes(
      get('/api/gtfs/stop-times?stopId=S1&date=20260105&count=abc'),
      db,
    );
    expect(res.status).toBe(400);
  });
});

describe('handleStopTimes — success', () => {
  it('returns 200 with the scheduled visits as JSON', async () => {
    const db = seededDb();
    const res = await handleStopTimes(
      get('/api/gtfs/stop-times?stopId=S1&date=20260105'),
      db,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');

    const visits = await res.json();
    expect(Array.isArray(visits)).toBe(true);
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({
      tripId: 'T1',
      stopId: 'S1',
      routeId: 'R1',
      headsign: 'Decatur',
    });
  });

  it('passes window params through to the query', async () => {
    const db = seededDb();
    const res = await handleStopTimes(
      get(
        // count=0 would normally clamp; we test count=1 + a future nowSec.
        '/api/gtfs/stop-times?stopId=S1&date=20260105&nowSec=1767610800&count=1',
      ),
      db,
    );
    expect(res.status).toBe(200);
    const visits = await res.json();
    expect(visits.length).toBeLessThanOrEqual(1);
  });

  it('sets a Cache-Control header with edge cache', async () => {
    const db = seededDb();
    const res = await handleStopTimes(
      get('/api/gtfs/stop-times?stopId=S1&date=20260105'),
      db,
    );
    const cc = res.headers.get('Cache-Control') ?? '';
    expect(cc).toMatch(/s-maxage=\d+/);
  });
});
