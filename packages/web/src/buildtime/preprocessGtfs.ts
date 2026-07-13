/**
 * Build-time static GTFS preprocessing — parse the GTFS ZIP from MARTA and
 * reshape into a small set of trimmed JSON files that the webapp consumes.
 *
 * Per ADR-0004, this runs at build time (nightly cron via Vercel) so the
 * client never has to download the multi-tens-of-MB raw GTFS feed.
 *
 * Pure functions only — no file I/O, no network. The scripts/ orchestrator
 * handles those concerns and calls into this module.
 */

import JSZip from 'jszip';
import Papa from 'papaparse';

// ---------------- Raw types (1:1 with GTFS CSV columns we use) ----------------

export interface RawStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
}

export interface RawRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
  route_color?: string | undefined;
}

export interface RawTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign?: string | undefined;
  direction_id?: number | undefined;
}

export interface RawStopTime {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  arrival_time: string;
  departure_time: string;
}

export interface RawCalendarRule {
  service_id: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  start_date: string;
  end_date: string;
}

export interface RawCalendarException {
  service_id: string;
  date: string;
  exception_type: 1 | 2;
}

export interface GtfsRaw {
  stops: RawStop[];
  routes: RawRoute[];
  trips: RawTrip[];
  stopTimes: RawStopTime[];
  calendar: RawCalendarRule[];
  calendarDates: RawCalendarException[];
}

// ---------------- Trimmed output types (what we ship to public/gtfs/) ----------------

/**
 * One `(route, headsign)` a stop is served by — the disambiguator rendered as
 * `route → headsign` (e.g. `11 → Collier Rd`) so same-name opposite-curb stops
 * are distinguishable. See ADR-0008.
 */
export interface StopDirection {
  routeId: string;
  headsign: string;
}

export interface StopOut {
  stopId: string;
  name: string;
  lat: number;
  lng: number;
  routeIds: string[];
  /**
   * Distinct `(route, headsign)` pairs serving this stop, ordered by descending
   * trip frequency then routeId then headsign. The frequency order makes top-N
   * truncation in the UI correctness-safe (ADR-0008). Empty when no trip serves
   * the stop.
   */
  directions: StopDirection[];
}

export interface RouteOut {
  routeId: string;
  shortName: string;
  longName: string;
  color?: string;
}

export interface TripOut {
  tripId: string;
  routeId: string;
  serviceId: string;
  headsign: string;
  directionId?: number;
}

export interface StopTimeOut {
  tripId: string;
  stopId: string;
  stopSequence: number;
  /** "HH:MM:SS" — may exceed 24:00:00 for trips crossing midnight, per GTFS spec. */
  arrivalTime: string;
  departureTime: string;
}

export interface CalendarRuleOut {
  serviceId: string;
  /** [mon, tue, wed, thu, fri, sat, sun] — true if service runs that day. */
  weekdays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  startDate: string;
  endDate: string;
}

export interface CalendarExceptionOut {
  serviceId: string;
  date: string;
  type: 'added' | 'removed';
}

export interface GtfsBundle {
  stops: StopOut[];
  routes: RouteOut[];
  trips: TripOut[];
  stopTimes: StopTimeOut[];
  calendar: {
    rules: CalendarRuleOut[];
    exceptions: CalendarExceptionOut[];
  };
}

// ---------------- Parsing ----------------

interface RawCsvs {
  stops: string;
  routes: string;
  trips: string;
  stop_times: string;
  calendar: string;
  calendar_dates?: string;
}

function parseCsv(csv: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV parse error: ${first?.message ?? 'unknown'}`);
  }
  return result.data;
}

function parseNumber(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Expected a numeric value, got: ${JSON.stringify(value)}`);
  }
  return n;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  return parseNumber(value);
}

function parseOptionalString(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  return value;
}

function parseGtfsBool(value: string | undefined): boolean {
  return value === '1';
}

export function parseGtfsCsvs(csvs: RawCsvs): GtfsRaw {
  const stops = parseCsv(csvs.stops).map(
    (r): RawStop => ({
      stop_id: r['stop_id'] ?? '',
      stop_name: r['stop_name'] ?? '',
      stop_lat: parseNumber(r['stop_lat']),
      stop_lon: parseNumber(r['stop_lon']),
    }),
  );

  const routes = parseCsv(csvs.routes).map(
    (r): RawRoute => ({
      route_id: r['route_id'] ?? '',
      route_short_name: r['route_short_name'] ?? '',
      route_long_name: r['route_long_name'] ?? '',
      route_type: parseNumber(r['route_type']),
      route_color: parseOptionalString(r['route_color']),
    }),
  );

  const trips = parseCsv(csvs.trips).map(
    (r): RawTrip => ({
      trip_id: r['trip_id'] ?? '',
      route_id: r['route_id'] ?? '',
      service_id: r['service_id'] ?? '',
      trip_headsign: parseOptionalString(r['trip_headsign']),
      direction_id: parseOptionalNumber(r['direction_id']),
    }),
  );

  const stopTimes = parseCsv(csvs.stop_times).map(
    (r): RawStopTime => ({
      trip_id: r['trip_id'] ?? '',
      stop_id: r['stop_id'] ?? '',
      stop_sequence: parseNumber(r['stop_sequence']),
      arrival_time: r['arrival_time'] ?? '',
      departure_time: r['departure_time'] ?? '',
    }),
  );

  const calendar = parseCsv(csvs.calendar).map(
    (r): RawCalendarRule => ({
      service_id: r['service_id'] ?? '',
      monday: parseGtfsBool(r['monday']),
      tuesday: parseGtfsBool(r['tuesday']),
      wednesday: parseGtfsBool(r['wednesday']),
      thursday: parseGtfsBool(r['thursday']),
      friday: parseGtfsBool(r['friday']),
      saturday: parseGtfsBool(r['saturday']),
      sunday: parseGtfsBool(r['sunday']),
      start_date: r['start_date'] ?? '',
      end_date: r['end_date'] ?? '',
    }),
  );

  const calendarDates = csvs.calendar_dates
    ? parseCsv(csvs.calendar_dates).map((r): RawCalendarException => {
        const type = parseNumber(r['exception_type']);
        if (type !== 1 && type !== 2) {
          throw new Error(`Unexpected calendar exception_type: ${type}`);
        }
        return {
          service_id: r['service_id'] ?? '',
          date: r['date'] ?? '',
          exception_type: type,
        };
      })
    : [];

  return { stops, routes, trips, stopTimes, calendar, calendarDates };
}

// ---------------- Transformation ----------------

/** Deterministic lexicographic order, matching Array.prototype.sort's default. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function transformGtfs(raw: GtfsRaw): GtfsBundle {
  // Index stops from trips + stop_times: the set of routeIds serving each stop,
  // plus the frequency of each distinct (routeId, headsign) pair for direction
  // disambiguation (ADR-0008). Both derive from the same stop_times ⋈ trips walk.
  const tripToInfo = new Map(
    raw.trips.map((t) => [t.trip_id, { routeId: t.route_id, headsign: t.trip_headsign ?? '' }]),
  );
  const stopToRoutes = new Map<string, Set<string>>();
  const stopToDirections = new Map<string, Map<string, StopDirection & { count: number }>>();
  for (const st of raw.stopTimes) {
    const info = tripToInfo.get(st.trip_id);
    if (info === undefined) continue;

    let routes = stopToRoutes.get(st.stop_id);
    if (routes === undefined) {
      routes = new Set();
      stopToRoutes.set(st.stop_id, routes);
    }
    routes.add(info.routeId);

    let directions = stopToDirections.get(st.stop_id);
    if (directions === undefined) {
      directions = new Map();
      stopToDirections.set(st.stop_id, directions);
    }
    const key = `${info.routeId} ${info.headsign}`;
    const existing = directions.get(key);
    if (existing === undefined) {
      directions.set(key, { routeId: info.routeId, headsign: info.headsign, count: 1 });
    } else {
      existing.count += 1;
    }
  }

  function directionsForStop(stopId: string): StopDirection[] {
    const byKey = stopToDirections.get(stopId);
    if (byKey === undefined) return [];
    return [...byKey.values()]
      .sort(
        (a, b) =>
          b.count - a.count ||
          compareStrings(a.routeId, b.routeId) ||
          compareStrings(a.headsign, b.headsign),
      )
      .map(({ routeId, headsign }) => ({ routeId, headsign }));
  }

  // Sort the client-facing arrays by primary key so the output bytes are
  // stable across nightly rebuilds regardless of MARTA's CSV row order. A
  // reshuffle upstream must not churn the ETag (and force clients to
  // re-fetch the SWR-cached bundle) when nothing actually changed.
  const stops: StopOut[] = raw.stops
    .map((s) => ({
      stopId: s.stop_id,
      name: s.stop_name,
      lat: s.stop_lat,
      lng: s.stop_lon,
      routeIds: [...(stopToRoutes.get(s.stop_id) ?? [])].sort(),
      directions: directionsForStop(s.stop_id),
    }))
    .sort((a, b) => compareStrings(a.stopId, b.stopId));

  const routes: RouteOut[] = raw.routes
    .map((r) => {
      const base = {
        routeId: r.route_id,
        shortName: r.route_short_name,
        longName: r.route_long_name,
      };
      return r.route_color === undefined ? base : { ...base, color: r.route_color };
    })
    .sort((a, b) => compareStrings(a.routeId, b.routeId));

  const trips: TripOut[] = raw.trips.map((t) => {
    const base = {
      tripId: t.trip_id,
      routeId: t.route_id,
      serviceId: t.service_id,
      headsign: t.trip_headsign ?? '',
    };
    return t.direction_id === undefined ? base : { ...base, directionId: t.direction_id };
  });

  const stopTimes: StopTimeOut[] = raw.stopTimes.map((st) => ({
    tripId: st.trip_id,
    stopId: st.stop_id,
    stopSequence: st.stop_sequence,
    arrivalTime: st.arrival_time,
    departureTime: st.departure_time,
  }));

  const rules: CalendarRuleOut[] = raw.calendar.map((c) => ({
    serviceId: c.service_id,
    weekdays: [c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday],
    startDate: c.start_date,
    endDate: c.end_date,
  }));

  const exceptions: CalendarExceptionOut[] = raw.calendarDates.map((e) => ({
    serviceId: e.service_id,
    date: e.date,
    type: e.exception_type === 1 ? 'added' : 'removed',
  }));

  return { stops, routes, trips, stopTimes, calendar: { rules, exceptions } };
}

// ---------------- ZIP wrapper ----------------

const REQUIRED_FILES = ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt'];

/**
 * Unzip a GTFS-static ZIP and parse its contents. Throws if any required
 * file is missing. calendar_dates.txt is optional.
 */
export async function parseGtfsZip(zipBytes: Uint8Array): Promise<GtfsRaw> {
  const zip = await JSZip.loadAsync(zipBytes);

  async function readRequired(filename: string): Promise<string> {
    const file = zip.file(filename);
    if (!file) throw new Error(`GTFS ZIP missing required file: ${filename}`);
    return file.async('string');
  }
  async function readOptional(filename: string): Promise<string | undefined> {
    const file = zip.file(filename);
    return file ? file.async('string') : undefined;
  }

  for (const f of REQUIRED_FILES) {
    if (!zip.file(f)) throw new Error(`GTFS ZIP missing required file: ${f}`);
  }

  const csvs: RawCsvs = {
    stops: await readRequired('stops.txt'),
    routes: await readRequired('routes.txt'),
    trips: await readRequired('trips.txt'),
    stop_times: await readRequired('stop_times.txt'),
    calendar: await readRequired('calendar.txt'),
  };
  const cd = await readOptional('calendar_dates.txt');
  if (cd !== undefined) {
    csvs.calendar_dates = cd;
  }

  return parseGtfsCsvs(csvs);
}
