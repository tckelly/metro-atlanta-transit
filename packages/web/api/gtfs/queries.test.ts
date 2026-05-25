import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { buildGtfsSqlite } from '../../src/buildtime/buildGtfsSqlite';
import { queryActiveServiceIds, queryScheduledVisits, queryRouteDirections } from './queries';
import type { GtfsBundle } from '../../src/buildtime/preprocessGtfs';

const BUNDLE: GtfsBundle = {
  stops: [{ stopId: 'S1', name: 'Test', lat: 0, lng: 0, routeIds: ['R1'] }],
  routes: [{ routeId: 'R1', shortName: '1', longName: 'One' }],
  trips: [
    // R1 → Decatur with 3 stops (the canonical longest pattern)
    { tripId: 'TA1', routeId: 'R1', serviceId: 'WK', headsign: 'Decatur' },
    // R1 → Decatur with 2 stops (a short turn-back; should be dropped)
    { tripId: 'TA2', routeId: 'R1', serviceId: 'WK', headsign: 'Decatur' },
    // R1 → Avondale (different headsign, separate direction)
    { tripId: 'TB1', routeId: 'R1', serviceId: 'WK', headsign: 'Avondale' },
    // Saturday-only trip
    { tripId: 'TS1', routeId: 'R1', serviceId: 'SAT', headsign: 'Decatur' },
  ],
  stopTimes: [
    // TA1 (Decatur, 3 stops)
    { tripId: 'TA1', stopId: 'S1', stopSequence: 1, arrivalTime: '06:00:00', departureTime: '06:00:00' },
    { tripId: 'TA1', stopId: 'S2', stopSequence: 2, arrivalTime: '06:05:00', departureTime: '06:05:00' },
    { tripId: 'TA1', stopId: 'S3', stopSequence: 3, arrivalTime: '06:10:00', departureTime: '06:10:00' },
    // TA2 (Decatur, 2 stops — shorter)
    { tripId: 'TA2', stopId: 'S2', stopSequence: 1, arrivalTime: '07:00:00', departureTime: '07:00:00' },
    { tripId: 'TA2', stopId: 'S3', stopSequence: 2, arrivalTime: '07:05:00', departureTime: '07:05:00' },
    // TB1 (Avondale)
    { tripId: 'TB1', stopId: 'S3', stopSequence: 1, arrivalTime: '06:00:00', departureTime: '06:00:00' },
    { tripId: 'TB1', stopId: 'S2', stopSequence: 2, arrivalTime: '06:05:00', departureTime: '06:05:00' },
    { tripId: 'TB1', stopId: 'S1', stopSequence: 3, arrivalTime: '06:10:00', departureTime: '06:10:00' },
    // TS1 (Saturday only — only S1)
    { tripId: 'TS1', stopId: 'S1', stopSequence: 1, arrivalTime: '08:00:00', departureTime: '08:00:00' },
  ],
  calendar: {
    rules: [
      {
        serviceId: 'WK',
        weekdays: [true, true, true, true, true, false, false],
        startDate: '20260101',
        endDate: '20261231',
      },
      {
        serviceId: 'SAT',
        weekdays: [false, false, false, false, false, true, false],
        startDate: '20260101',
        endDate: '20261231',
      },
    ],
    exceptions: [
      { serviceId: 'WK', date: '20260704', type: 'removed' }, // Fourth of July
      { serviceId: 'SAT', date: '20260704', type: 'added' }, // Holiday Saturday service
    ],
  },
};

function buildSeededDb(bundle: GtfsBundle = BUNDLE): InstanceType<typeof Database> {
  const db = new Database(':memory:');
  buildGtfsSqlite(bundle, db);
  return db;
}

describe('queryActiveServiceIds', () => {
  it('returns weekday services on a regular Monday', () => {
    // 2026-01-05 is a Monday
    const db = buildSeededDb();
    const active = queryActiveServiceIds(db, '20260105');
    expect([...active]).toEqual(['WK']);
  });

  it('returns Saturday services on a Saturday', () => {
    // 2026-01-03 is a Saturday
    const db = buildSeededDb();
    const active = queryActiveServiceIds(db, '20260103');
    expect([...active]).toEqual(['SAT']);
  });

  it('honors `removed` exceptions — Fourth of July is NOT a weekday', () => {
    // 2026-07-04 is a Saturday; WK is removed by exception, SAT is added
    const db = buildSeededDb();
    const active = queryActiveServiceIds(db, '20260704');
    expect(active.has('WK')).toBe(false);
    expect(active.has('SAT')).toBe(true);
  });

  it('returns empty Set for dates outside any service window', () => {
    const db = buildSeededDb();
    const active = queryActiveServiceIds(db, '20300101');
    expect(active.size).toBe(0);
  });
});

describe('queryScheduledVisits', () => {
  it('returns weekday visits at a stop on a weekday', () => {
    const db = buildSeededDb();
    const visits = queryScheduledVisits(db, { stopId: 'S1', date: '20260105' });
    // S1 is served by TA1 (Decatur) and TB1 (Avondale) on weekdays.
    expect(visits).toHaveLength(2);
    const tripIds = visits.map((v) => v.tripId).sort();
    expect(tripIds).toEqual(['TA1', 'TB1']);
  });

  it('sorts visits by scheduled time ascending', () => {
    const db = buildSeededDb();
    const visits = queryScheduledVisits(db, { stopId: 'S1', date: '20260105' });
    const times = visits.map((v) => v.scheduledTime);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('honors the calendar — Saturday visit shows on Saturday, not weekday', () => {
    const db = buildSeededDb();
    // 2026-01-03 is a Saturday — TS1 runs.
    const sat = queryScheduledVisits(db, { stopId: 'S1', date: '20260103' });
    expect(sat.some((v) => v.tripId === 'TS1')).toBe(true);
    // 2026-01-05 is a Monday — TS1 must NOT show.
    const mon = queryScheduledVisits(db, { stopId: 'S1', date: '20260105' });
    expect(mon.some((v) => v.tripId === 'TS1')).toBe(false);
  });

  it('returns empty for an unknown stop', () => {
    const db = buildSeededDb();
    expect(queryScheduledVisits(db, { stopId: 'NOPE', date: '20260105' })).toEqual([]);
  });

  it('attaches the trip’s routeId and headsign to each visit', () => {
    const db = buildSeededDb();
    const visits = queryScheduledVisits(db, { stopId: 'S1', date: '20260105' });
    const decatur = visits.find((v) => v.tripId === 'TA1');
    expect(decatur?.routeId).toBe('R1');
    expect(decatur?.headsign).toBe('Decatur');
  });

  it('applies the count + window filter when nowSec is supplied', () => {
    const db = buildSeededDb();
    // 06:00 EDT on 2026-01-05 = 1767610800 Unix seconds.
    const visits = queryScheduledVisits(db, {
      stopId: 'S1',
      date: '20260105',
      nowSec: 1767610800,
      count: 1,
    });
    expect(visits).toHaveLength(1);
  });
});

describe('queryRouteDirections', () => {
  it('returns one entry per unique headsign on the route', () => {
    const db = buildSeededDb();
    const directions = queryRouteDirections(db, 'R1');
    expect(directions.map((d) => d.headsign).sort()).toEqual(['Avondale', 'Decatur']);
  });

  it('picks the longest trip pattern per headsign', () => {
    // TA1 has 3 stops; TA2 has 2. Decatur should follow TA1.
    const db = buildSeededDb();
    const decatur = queryRouteDirections(db, 'R1').find((d) => d.headsign === 'Decatur');
    expect(decatur?.stopIds).toEqual(['S1', 'S2', 'S3']);
  });

  it('orders stops by stop_sequence ascending', () => {
    const db = buildSeededDb();
    const avondale = queryRouteDirections(db, 'R1').find((d) => d.headsign === 'Avondale');
    expect(avondale?.stopIds).toEqual(['S3', 'S2', 'S1']);
  });

  it('returns empty for an unknown route', () => {
    const db = buildSeededDb();
    expect(queryRouteDirections(db, 'NOPE')).toEqual([]);
  });
});
