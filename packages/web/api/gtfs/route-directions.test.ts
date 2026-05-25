import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { handleRouteDirections } from './route-directions';
import { buildGtfsSqlite } from '../../src/buildtime/buildGtfsSqlite';
import type { GtfsBundle } from '../../src/buildtime/preprocessGtfs';

const BUNDLE: GtfsBundle = {
  stops: [
    { stopId: 'S1', name: 'A', lat: 0, lng: 0, routeIds: ['R1'] },
    { stopId: 'S2', name: 'B', lat: 0, lng: 0, routeIds: ['R1'] },
  ],
  routes: [{ routeId: 'R1', shortName: '1', longName: 'One' }],
  trips: [
    { tripId: 'T1', routeId: 'R1', serviceId: 'WK', headsign: 'Decatur' },
  ],
  stopTimes: [
    { tripId: 'T1', stopId: 'S1', stopSequence: 1, arrivalTime: '06:00:00', departureTime: '06:00:00' },
    { tripId: 'T1', stopId: 'S2', stopSequence: 2, arrivalTime: '06:05:00', departureTime: '06:05:00' },
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

describe('handleRouteDirections', () => {
  it('rejects non-GET with 405', async () => {
    const res = await handleRouteDirections(
      new Request('https://example.test/api/gtfs/route-directions', { method: 'POST' }),
      seededDb(),
    );
    expect(res.status).toBe(405);
  });

  it('returns 400 when routeId is missing', async () => {
    const res = await handleRouteDirections(get('/api/gtfs/route-directions'), seededDb());
    expect(res.status).toBe(400);
  });

  it('returns 200 with the wire-shape directions for a known route', async () => {
    const res = await handleRouteDirections(
      get('/api/gtfs/route-directions?routeId=R1'),
      seededDb(),
    );
    expect(res.status).toBe(200);
    const directions = await res.json();
    expect(directions).toHaveLength(1);
    expect(directions[0]).toEqual({
      headsign: 'Decatur',
      stopIds: ['S1', 'S2'],
    });
  });

  it('returns 200 with an empty array for an unknown route', async () => {
    const res = await handleRouteDirections(
      get('/api/gtfs/route-directions?routeId=NOPE'),
      seededDb(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('sets a Cache-Control header with edge cache', async () => {
    const res = await handleRouteDirections(
      get('/api/gtfs/route-directions?routeId=R1'),
      seededDb(),
    );
    const cc = res.headers.get('Cache-Control') ?? '';
    expect(cc).toMatch(/s-maxage=\d+/);
  });
});
