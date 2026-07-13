import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';

import { parseGtfsCsvs, transformGtfs, parseGtfsZip, type GtfsRaw } from './preprocessGtfs';

/** Build a full GtfsRaw from a partial, defaulting every table to empty. */
function rawWith(parts: Partial<GtfsRaw>): GtfsRaw {
  return {
    stops: [],
    routes: [],
    trips: [],
    stopTimes: [],
    calendar: [],
    calendarDates: [],
    ...parts,
  };
}

// Hand-crafted fixture. Three stops, two routes (one with color), two trips,
// 6 stop_times, one calendar rule, one calendar exception. Enough to exercise
// every code path without needing the full MARTA dump.

const FIXTURE_CSVS = {
  stops: `stop_id,stop_name,stop_lat,stop_lon
S1,"Virginia Ave @ N Highland",33.7825,-84.3528
S2,"Highland Ave @ Greenwood",33.7811,-84.3534
S3,Ponce @ Barnett,33.7720,-84.3617`,

  routes: `route_id,route_short_name,route_long_name,route_type,route_color
R36,36,"Virginia Highland - Decatur",3,0066CC
R102,102,Lindbergh - Inman Park,3,`,

  trips: `trip_id,route_id,service_id,trip_headsign,direction_id
T1,R36,WEEKDAY,Decatur Station,0
T2,R36,WEEKDAY,Midtown,1`,

  stop_times: `trip_id,stop_id,stop_sequence,arrival_time,departure_time
T1,S1,1,06:00:00,06:00:00
T1,S2,2,06:03:00,06:03:00
T1,S3,3,06:08:00,06:08:00
T2,S3,1,06:30:00,06:30:00
T2,S2,2,06:35:00,06:35:00
T2,S1,3,06:38:00,06:38:00`,

  calendar: `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
WEEKDAY,1,1,1,1,1,0,0,20260101,20261231`,

  calendar_dates: `service_id,date,exception_type
WEEKDAY,20260704,2`,
};

describe('parseGtfsCsvs', () => {
  it('parses stops with numeric coordinates', () => {
    const raw = parseGtfsCsvs(FIXTURE_CSVS);
    expect(raw.stops).toHaveLength(3);
    expect(raw.stops[0]).toEqual({
      stop_id: 'S1',
      stop_name: 'Virginia Ave @ N Highland',
      stop_lat: 33.7825,
      stop_lon: -84.3528,
    });
  });

  it('parses routes and treats empty color as undefined', () => {
    const raw = parseGtfsCsvs(FIXTURE_CSVS);
    expect(raw.routes).toHaveLength(2);
    expect(raw.routes[0]?.route_color).toBe('0066CC');
    expect(raw.routes[1]?.route_color).toBeUndefined();
  });

  it('parses trips with optional direction_id', () => {
    const raw = parseGtfsCsvs(FIXTURE_CSVS);
    expect(raw.trips).toHaveLength(2);
    expect(raw.trips[0]?.direction_id).toBe(0);
    expect(raw.trips[1]?.direction_id).toBe(1);
  });

  it('parses stop_times with numeric stop_sequence', () => {
    const raw = parseGtfsCsvs(FIXTURE_CSVS);
    expect(raw.stopTimes).toHaveLength(6);
    expect(raw.stopTimes[0]).toEqual({
      trip_id: 'T1',
      stop_id: 'S1',
      stop_sequence: 1,
      arrival_time: '06:00:00',
      departure_time: '06:00:00',
    });
  });

  it('parses calendar with day-of-week booleans', () => {
    const raw = parseGtfsCsvs(FIXTURE_CSVS);
    expect(raw.calendar).toHaveLength(1);
    expect(raw.calendar[0]).toEqual({
      service_id: 'WEEKDAY',
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      start_date: '20260101',
      end_date: '20261231',
    });
  });

  it('parses calendar_dates exceptions when present', () => {
    const raw = parseGtfsCsvs(FIXTURE_CSVS);
    expect(raw.calendarDates).toEqual([
      { service_id: 'WEEKDAY', date: '20260704', exception_type: 2 },
    ]);
  });

  it('returns empty array when calendar_dates is omitted', () => {
    const { calendar_dates: _omitted, ...withoutCd } = FIXTURE_CSVS;
    void _omitted;
    const raw = parseGtfsCsvs(withoutCd);
    expect(raw.calendarDates).toEqual([]);
  });
});

describe('transformGtfs', () => {
  it('annotates each stop with the routes that serve it (derived from trips + stop_times)', () => {
    const bundle = transformGtfs(parseGtfsCsvs(FIXTURE_CSVS));
    const s1 = bundle.stops.find((s) => s.stopId === 'S1');
    expect(s1?.routeIds).toEqual(['R36']);
    const s2 = bundle.stops.find((s) => s.stopId === 'S2');
    expect(s2?.routeIds).toEqual(['R36']);
  });

  it('preserves stop names and coordinates through the transform', () => {
    const bundle = transformGtfs(parseGtfsCsvs(FIXTURE_CSVS));
    expect(bundle.stops[0]).toMatchObject({
      stopId: 'S1',
      name: 'Virginia Ave @ N Highland',
      lat: 33.7825,
      lng: -84.3528,
    });
  });

  it('omits route color when the source row had an empty value', () => {
    const bundle = transformGtfs(parseGtfsCsvs(FIXTURE_CSVS));
    const r36 = bundle.routes.find((r) => r.routeId === 'R36');
    const r102 = bundle.routes.find((r) => r.routeId === 'R102');
    expect(r36).toMatchObject({ routeId: 'R36', color: '0066CC' });
    expect(r102).toMatchObject({ routeId: 'R102' });
    expect(r102).not.toHaveProperty('color');
  });

  it('encodes calendar rules as a [mon..sun] boolean tuple', () => {
    const bundle = transformGtfs(parseGtfsCsvs(FIXTURE_CSVS));
    expect(bundle.calendar.rules[0]?.weekdays).toEqual([true, true, true, true, true, false, false]);
  });

  it('maps calendar exception_type 1/2 to added/removed', () => {
    const bundle = transformGtfs(parseGtfsCsvs(FIXTURE_CSVS));
    expect(bundle.calendar.exceptions).toEqual([
      { serviceId: 'WEEKDAY', date: '20260704', type: 'removed' },
    ]);
  });

  it('preserves headsign from trip_headsign', () => {
    const bundle = transformGtfs(parseGtfsCsvs(FIXTURE_CSVS));
    const trip1 = bundle.trips.find((t) => t.tripId === 'T1');
    expect(trip1?.headsign).toBe('Decatur Station');
  });

  it('computes per-stop (routeId, headsign) direction pairs', () => {
    const bundle = transformGtfs(parseGtfsCsvs(FIXTURE_CSVS));
    // S1 is served by both R36 trips (T1 outbound, T2 inbound), so it carries
    // both directions. Equal frequency (1 each) → deterministic tie-break by
    // routeId then headsign: "Decatur Station" before "Midtown".
    const s1 = bundle.stops.find((s) => s.stopId === 'S1');
    expect(s1?.directions).toEqual([
      { routeId: 'R36', headsign: 'Decatur Station' },
      { routeId: 'R36', headsign: 'Midtown' },
    ]);
  });

  it('orders stops by stopId regardless of source row order', () => {
    const raw = rawWith({
      stops: [
        { stop_id: 'S3', stop_name: 'Third', stop_lat: 0, stop_lon: 0 },
        { stop_id: 'S1', stop_name: 'First', stop_lat: 0, stop_lon: 0 },
        { stop_id: 'S2', stop_name: 'Second', stop_lat: 0, stop_lon: 0 },
      ],
    });
    expect(transformGtfs(raw).stops.map((s) => s.stopId)).toEqual(['S1', 'S2', 'S3']);
  });

  it('orders routes by routeId regardless of source row order', () => {
    const raw = rawWith({
      routes: [
        { route_id: 'R3', route_short_name: '3', route_long_name: 'Three', route_type: 3 },
        { route_id: 'R1', route_short_name: '1', route_long_name: 'One', route_type: 3 },
        { route_id: 'R2', route_short_name: '2', route_long_name: 'Two', route_type: 3 },
      ],
    });
    expect(transformGtfs(raw).routes.map((r) => r.routeId)).toEqual(['R1', 'R2', 'R3']);
  });

  it('produces byte-identical stops/routes JSON when the same rows arrive shuffled', () => {
    // The nightly rebuild's ETag should only change when data changes — not
    // when MARTA happens to reorder rows. Same rows, reversed input order,
    // must serialize identically. See ADR-0008 caching notes.
    const stops = [
      { stop_id: 'S3', stop_name: 'Third', stop_lat: 1, stop_lon: 1 },
      { stop_id: 'S1', stop_name: 'First', stop_lat: 2, stop_lon: 2 },
      { stop_id: 'S2', stop_name: 'Second', stop_lat: 3, stop_lon: 3 },
    ];
    const routes = [
      { route_id: 'R2', route_short_name: '2', route_long_name: 'Two', route_type: 3 },
      { route_id: 'R1', route_short_name: '1', route_long_name: 'One', route_type: 3 },
    ];
    const forward = transformGtfs(rawWith({ stops, routes }));
    const reversed = transformGtfs(
      rawWith({ stops: [...stops].reverse(), routes: [...routes].reverse() }),
    );
    expect(JSON.stringify(reversed.stops)).toEqual(JSON.stringify(forward.stops));
    expect(JSON.stringify(reversed.routes)).toEqual(JSON.stringify(forward.routes));
  });

  it('orders a stop\'s directions by descending trip frequency, deduping pairs', () => {
    // SX: RB→Beta served by 3 trips, RA→Alpha by 1. Frequency-desc must put
    // Beta first even though RA sorts earlier alphabetically — this is what
    // makes top-N truncation correctness-safe (ADR-0008). Also proves the
    // repeated (RB, Beta) pair collapses to a single entry.
    const raw = rawWith({
      stops: [{ stop_id: 'SX', stop_name: 'X', stop_lat: 0, stop_lon: 0 }],
      trips: [
        { trip_id: 'T1', route_id: 'RA', service_id: 'W', trip_headsign: 'Alpha' },
        { trip_id: 'T2', route_id: 'RB', service_id: 'W', trip_headsign: 'Beta' },
        { trip_id: 'T3', route_id: 'RB', service_id: 'W', trip_headsign: 'Beta' },
        { trip_id: 'T4', route_id: 'RB', service_id: 'W', trip_headsign: 'Beta' },
      ],
      stopTimes: ['T1', 'T2', 'T3', 'T4'].map((tripId, i) => ({
        trip_id: tripId,
        stop_id: 'SX',
        stop_sequence: i + 1,
        arrival_time: '06:00:00',
        departure_time: '06:00:00',
      })),
    });
    const sx = transformGtfs(raw).stops.find((s) => s.stopId === 'SX');
    expect(sx?.directions).toEqual([
      { routeId: 'RB', headsign: 'Beta' },
      { routeId: 'RA', headsign: 'Alpha' },
    ]);
  });
});

describe('parseGtfsZip', () => {
  it('unzips and parses a GTFS ZIP end-to-end', async () => {
    const zip = new JSZip();
    for (const [name, content] of Object.entries(FIXTURE_CSVS)) {
      // calendar_dates → calendar_dates.txt; everything else uses key + .txt
      zip.file(`${name}.txt`, content);
    }
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const raw = await parseGtfsZip(bytes);
    expect(raw.stops).toHaveLength(3);
    expect(raw.routes).toHaveLength(2);
    expect(raw.trips).toHaveLength(2);
    expect(raw.calendarDates).toHaveLength(1);
  });

  it('throws when a required file is missing', async () => {
    const zip = new JSZip();
    // Omit stops.txt
    zip.file('routes.txt', FIXTURE_CSVS.routes);
    zip.file('trips.txt', FIXTURE_CSVS.trips);
    zip.file('stop_times.txt', FIXTURE_CSVS.stop_times);
    zip.file('calendar.txt', FIXTURE_CSVS.calendar);
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    await expect(parseGtfsZip(bytes)).rejects.toThrow(/stops\.txt/);
  });
});
