import { describe, it, expect } from 'vitest';

import {
  gtfsTimeToUnixSec,
  getActiveServiceIds,
  getScheduledVisitsForStop,
} from './gtfsStatic';
import type { GtfsBundle } from '../buildtime/preprocessGtfs';

// Synthesized bundle for query-layer tests. Two trips on weekdays + one on
// weekends, three stops, calendar exception removing service on July 4.
const BUNDLE: GtfsBundle = {
  stops: [
    { stopId: 'S1', name: 'Virginia Ave', lat: 33.78, lng: -84.35, routeIds: ['R36'], directions: [] },
    { stopId: 'S2', name: 'Highland Ave', lat: 33.78, lng: -84.35, routeIds: ['R36'], directions: [] },
    { stopId: 'S3', name: 'Ponce',        lat: 33.77, lng: -84.36, routeIds: ['R36'], directions: [] },
  ],
  routes: [
    { routeId: 'R36', shortName: '36', longName: 'Virginia Highland - Decatur' },
  ],
  trips: [
    { tripId: 'T1', routeId: 'R36', serviceId: 'WEEKDAY', headsign: 'Decatur Station', directionId: 0 },
    { tripId: 'T2', routeId: 'R36', serviceId: 'WEEKDAY', headsign: 'Decatur Station', directionId: 0 },
    { tripId: 'T3', routeId: 'R36', serviceId: 'WEEKEND', headsign: 'Decatur Station', directionId: 0 },
  ],
  stopTimes: [
    { tripId: 'T1', stopId: 'S1', stopSequence: 1, arrivalTime: '06:00:00', departureTime: '06:00:00' },
    { tripId: 'T1', stopId: 'S2', stopSequence: 2, arrivalTime: '06:03:00', departureTime: '06:03:00' },
    { tripId: 'T2', stopId: 'S1', stopSequence: 1, arrivalTime: '06:30:00', departureTime: '06:30:00' },
    { tripId: 'T3', stopId: 'S1', stopSequence: 1, arrivalTime: '09:00:00', departureTime: '09:00:00' },
  ],
  calendar: {
    rules: [
      {
        serviceId: 'WEEKDAY',
        weekdays: [true, true, true, true, true, false, false],
        startDate: '20260101',
        endDate: '20261231',
      },
      {
        serviceId: 'WEEKEND',
        weekdays: [false, false, false, false, false, true, true],
        startDate: '20260101',
        endDate: '20261231',
      },
    ],
    exceptions: [
      { serviceId: 'WEEKDAY', date: '20260703', type: 'removed' }, // Friday cancelled
    ],
  },
};

describe('gtfsTimeToUnixSec', () => {
  it('converts 06:00:00 on 2026-05-22 (EDT) to the correct Unix seconds', () => {
    // 2026-05-22 06:00:00 EDT = 2026-05-22 10:00:00 UTC = 1779444000
    expect(gtfsTimeToUnixSec('20260522', '06:00:00')).toBe(1779444000);
  });

  it('converts 06:00:00 on 2026-01-15 (EST) to the correct Unix seconds', () => {
    // 2026-01-15 06:00:00 EST = 2026-01-15 11:00:00 UTC = 1768474800
    expect(gtfsTimeToUnixSec('20260115', '06:00:00')).toBe(1768474800);
  });

  it('handles GTFS times past 24:00 by rolling to the next day', () => {
    // 25:30:00 on 2026-05-22 = 01:30:00 on 2026-05-23 EDT
    const past24 = gtfsTimeToUnixSec('20260522', '25:30:00');
    const sameAsNextDay = gtfsTimeToUnixSec('20260523', '01:30:00');
    expect(past24).toBe(sameAsNextDay);
  });

  it('accepts space-padded single-digit hours (MARTA quirk: " 6:07:50" instead of "06:07:50")', () => {
    // MARTA's stop_times.txt uses leading spaces instead of zero-padding
    // for single-digit hours. Treat that as equivalent.
    const spacePadded = gtfsTimeToUnixSec('20260522', ' 6:00:00');
    const zeroPadded = gtfsTimeToUnixSec('20260522', '06:00:00');
    expect(spacePadded).toBe(zeroPadded);
  });

  it('throws on malformed input', () => {
    expect(() => gtfsTimeToUnixSec('bogus', '06:00:00')).toThrow();
    expect(() => gtfsTimeToUnixSec('20260522', 'not-a-time')).toThrow();
  });
});

describe('getActiveServiceIds', () => {
  it('returns WEEKDAY on a normal Friday', () => {
    // 2026-05-22 is a Friday
    expect(getActiveServiceIds(BUNDLE, '20260522')).toEqual(new Set(['WEEKDAY']));
  });

  it('returns WEEKEND on a Saturday', () => {
    // 2026-05-23 is a Saturday
    expect(getActiveServiceIds(BUNDLE, '20260523')).toEqual(new Set(['WEEKEND']));
  });

  it('removes a service on a calendar_dates "removed" exception date', () => {
    // 2026-07-03 is a Friday but the bundle has a "removed" exception
    expect(getActiveServiceIds(BUNDLE, '20260703')).toEqual(new Set());
  });

  it('returns empty for dates outside the rule range', () => {
    expect(getActiveServiceIds(BUNDLE, '20250101')).toEqual(new Set());
  });
});

describe('getScheduledVisitsForStop', () => {
  it('returns weekday-only visits on a weekday', () => {
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522');
    expect(visits).toHaveLength(2);
    expect(visits.map((v) => v.tripId)).toEqual(['T1', 'T2']);
  });

  it('returns weekend-only visits on a weekend', () => {
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260523');
    expect(visits.map((v) => v.tripId)).toEqual(['T3']);
  });

  it('orders visits by scheduled time ascending', () => {
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522');
    const times = visits.map((v) => v.scheduledTime);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('attaches headsign and routeId from the trip', () => {
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522');
    expect(visits[0]?.headsign).toBe('Decatur Station');
    expect(visits[0]?.routeId).toBe('R36');
  });

  it('returns an empty array for stops with no scheduled service on this date', () => {
    expect(getScheduledVisitsForStop(BUNDLE, 'S3', '20260522')).toEqual([]);
  });

  it('produces visits whose scheduledTime feeds the classifier correctly', () => {
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522');
    // S1 at 06:00 EDT 2026-05-22 = 1779444000
    expect(visits[0]?.scheduledTime).toBe(1779444000);
  });

  it('filters to a forward time window when given nowSec, dropping past trips', () => {
    // 2026-05-22 — bundle has T1 at 06:00 EDT (1779444000) and T2 at 06:30 EDT.
    // If "now" is 06:15 EDT, we should only see T2 (06:30), not T1 (already happened).
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522', {
      nowSec: 1779444000 + 15 * 60, // 06:15 EDT
    });
    expect(visits.map((v) => v.tripId)).toEqual(['T2']);
  });

  it('honors a custom forward window in seconds', () => {
    // Bundle has T1 at 06:00 and T2 at 06:30 EDT.
    // If "now" is 05:50 EDT and window is 15 min, only T1 should be visible.
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522', {
      nowSec: 1779444000 - 10 * 60, // 05:50 EDT
      windowSec: 15 * 60,
    });
    expect(visits.map((v) => v.tripId)).toEqual(['T1']);
  });

  it('includes a small grace window for buses that "just passed"', () => {
    // If "now" is 06:00:30 EDT (30s after T1's scheduled time), T1 should
    // still be visible so users at the stop don't lose context on a bus
    // that may have just passed or is currently boarding.
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522', {
      nowSec: 1779444000 + 30,
    });
    expect(visits.map((v) => v.tripId)).toContain('T1');
  });

  it('returns the full day when no nowSec is supplied (backwards-compatible default)', () => {
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522');
    expect(visits).toHaveLength(2);
  });

  it('caps results at the provided count', () => {
    // Bundle has T1 at 06:00 and T2 at 06:30 — both upcoming if now is 05:30.
    // count=1 should return only the next one (T1).
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522', {
      nowSec: 1779444000 - 30 * 60,
      count: 1,
    });
    expect(visits.map((v) => v.tripId)).toEqual(['T1']);
  });

  it('returns next visits even when they are hours away (no implicit time cap)', () => {
    // Now is 05:00 EDT — first bus (T1 at 06:00) is an hour away. With no
    // explicit windowSec, the result should still include it.
    const visits = getScheduledVisitsForStop(BUNDLE, 'S1', '20260522', {
      nowSec: 1779444000 - 60 * 60,
    });
    expect(visits.map((v) => v.tripId)).toEqual(['T1', 'T2']);
  });
});
