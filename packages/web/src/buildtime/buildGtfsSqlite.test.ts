import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { buildGtfsSqlite } from './buildGtfsSqlite';
import type { GtfsBundle } from './preprocessGtfs';

const BUNDLE: GtfsBundle = {
  stops: [{ stopId: 'S1', name: 'Test', lat: 0, lng: 0, routeIds: ['R1'], directions: [] }],
  routes: [{ routeId: 'R1', shortName: '1', longName: 'One' }],
  trips: [
    { tripId: 'T1', routeId: 'R1', serviceId: 'WK', headsign: 'Decatur', directionId: 0 },
    { tripId: 'T2', routeId: 'R1', serviceId: 'WK', headsign: 'Avondale' },
  ],
  stopTimes: [
    {
      tripId: 'T1',
      stopId: 'S1',
      stopSequence: 1,
      arrivalTime: '06:00:00',
      departureTime: '06:00:00',
    },
    {
      tripId: 'T2',
      stopId: 'S1',
      stopSequence: 1,
      arrivalTime: '07:00:00',
      departureTime: '07:00:00',
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
    exceptions: [{ serviceId: 'WK', date: '20260704', type: 'removed' }],
  },
};

function buildInMemory(bundle: GtfsBundle): InstanceType<typeof Database> {
  const db = new Database(':memory:');
  buildGtfsSqlite(bundle, db);
  return db;
}

describe('buildGtfsSqlite — schema', () => {
  it('creates the four expected tables', () => {
    const db = buildInMemory(BUNDLE);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    expect(tables.map((r) => r.name)).toEqual([
      'calendar_exceptions',
      'calendar_rules',
      'stop_times',
      'trips',
    ]);
  });

  it('indexes stop_times by stop_id so per-stop queries are fast', () => {
    const db = buildInMemory(BUNDLE);
    const indices = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'stop_times'",
      )
      .all() as Array<{ name: string }>;
    expect(indices.some((r) => r.name.includes('stop_id'))).toBe(true);
  });

  it('indexes trips by route_id so route-direction queries are fast', () => {
    const db = buildInMemory(BUNDLE);
    const indices = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'trips'")
      .all() as Array<{ name: string }>;
    expect(indices.some((r) => r.name.includes('route_id'))).toBe(true);
  });
});

describe('buildGtfsSqlite — data', () => {
  it('inserts every trip with full metadata', () => {
    const db = buildInMemory(BUNDLE);
    const trips = db
      .prepare('SELECT * FROM trips ORDER BY trip_id')
      .all() as Array<{
        trip_id: string;
        route_id: string;
        service_id: string;
        headsign: string;
        direction_id: number | null;
      }>;
    expect(trips).toHaveLength(2);
    expect(trips[0]?.trip_id).toBe('T1');
    expect(trips[0]?.route_id).toBe('R1');
    expect(trips[0]?.headsign).toBe('Decatur');
    expect(trips[0]?.direction_id).toBe(0);
    expect(trips[1]?.direction_id).toBeNull();
  });

  it('inserts every stop_time', () => {
    const db = buildInMemory(BUNDLE);
    const count = db.prepare('SELECT COUNT(*) AS n FROM stop_times').get() as { n: number };
    expect(count.n).toBe(2);
  });

  it('inserts calendar rules with booleans encoded as 0/1', () => {
    const db = buildInMemory(BUNDLE);
    const rule = db.prepare('SELECT * FROM calendar_rules WHERE service_id = ?').get('WK') as {
      monday: number;
      saturday: number;
      sunday: number;
      start_date: string;
      end_date: string;
    };
    expect(rule.monday).toBe(1);
    expect(rule.saturday).toBe(0);
    expect(rule.sunday).toBe(0);
    expect(rule.start_date).toBe('20260101');
    expect(rule.end_date).toBe('20261231');
  });

  it('inserts calendar exceptions', () => {
    const db = buildInMemory(BUNDLE);
    const exceptions = db.prepare('SELECT * FROM calendar_exceptions').all() as Array<{
      service_id: string;
      date: string;
      type: string;
    }>;
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.type).toBe('removed');
  });
});

describe('buildGtfsSqlite — query patterns', () => {
  it('supports "stop_times at a stop joined with trips" — the per-stop arrivals query', () => {
    const db = buildInMemory(BUNDLE);
    const rows = db
      .prepare(
        `SELECT st.trip_id, st.arrival_time, t.route_id, t.headsign, t.service_id
         FROM stop_times st
         JOIN trips t ON t.trip_id = st.trip_id
         WHERE st.stop_id = ?
         ORDER BY st.arrival_time`,
      )
      .all('S1') as Array<{ trip_id: string; headsign: string }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]?.trip_id).toBe('T1');
    expect(rows[0]?.headsign).toBe('Decatur');
  });

  it('supports "all trips on a route grouped by headsign" — the route-directions query', () => {
    const db = buildInMemory(BUNDLE);
    const rows = db
      .prepare('SELECT DISTINCT headsign FROM trips WHERE route_id = ? ORDER BY headsign')
      .all('R1') as Array<{ headsign: string }>;
    expect(rows.map((r) => r.headsign)).toEqual(['Avondale', 'Decatur']);
  });
});
