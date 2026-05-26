/**
 * Pure query functions over the GTFS SQLite database.
 *
 * Kept separate from the Vercel function handlers so they can be
 * unit-tested with an in-memory database — no HTTP, no filesystem,
 * no Vercel runtime. The handlers in `stop-times.ts` and
 * `route-directions.ts` are thin wrappers that read params from
 * the Request and call these functions.
 *
 * See ADR-0006.
 */
import type Database from 'better-sqlite3';

import { gtfsTimeToUnixSec } from '../../src/services/gtfsStatic.js';
import type { ScheduledStopVisit } from '../../src/features/stops/busRowClassifier.js';

const PAST_GRACE_SEC = 60;
const DEFAULT_COUNT = 5;

export interface ScheduledVisitsParams {
  stopId: string;
  date: string;
  nowSec?: number;
  count?: number;
  windowSec?: number;
}

export interface RouteDirectionWire {
  headsign: string;
  /** Stop IDs in stop_sequence order. Caller looks up StopOut metadata. */
  stopIds: string[];
}

const WEEKDAY_COLUMNS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/**
 * Active service IDs for a GTFS service date — calendar rules
 * intersected with the day-of-week, then exceptions applied.
 * Mirrors the JS implementation in `gtfsStatic.getActiveServiceIds`.
 */
export function queryActiveServiceIds(db: Database.Database, date: string): Set<string> {
  if (!/^\d{8}$/.test(date)) {
    throw new Error(`Invalid service date: ${date}`);
  }

  const year = Number(date.substring(0, 4));
  const month = Number(date.substring(4, 6));
  const day = Number(date.substring(6, 8));
  // Day index aligned with the bundle's weekdays tuple: Mon=0..Sun=6.
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const monIndex = (jsDay + 6) % 7;
  const weekdayColumn = WEEKDAY_COLUMNS[monIndex];

  const rules = db
    .prepare(
      `SELECT service_id FROM calendar_rules
       WHERE start_date <= ? AND end_date >= ? AND ${weekdayColumn} = 1`,
    )
    .all(date, date) as Array<{ service_id: string }>;

  const active = new Set(rules.map((r) => r.service_id));

  const exceptions = db
    .prepare('SELECT service_id, type FROM calendar_exceptions WHERE date = ?')
    .all(date) as Array<{ service_id: string; type: 'added' | 'removed' }>;

  for (const exc of exceptions) {
    if (exc.type === 'added') active.add(exc.service_id);
    else active.delete(exc.service_id);
  }

  return active;
}

/**
 * Scheduled visits at a stop on a date. The window slicing matches
 * `gtfsStatic.getScheduledVisitsForStop` so the backend and the
 * in-memory implementation agree on the result shape.
 */
export function queryScheduledVisits(
  db: Database.Database,
  params: ScheduledVisitsParams,
): ScheduledStopVisit[] {
  const activeServices = queryActiveServiceIds(db, params.date);
  if (activeServices.size === 0) return [];

  // SQL's `IN (?,?,?)` needs the right number of placeholders. Building
  // a parameterized list per service id keeps us inside prepared-
  // statement safety with no string interpolation of values.
  const placeholders = Array.from({ length: activeServices.size }, () => '?').join(',');
  const rows = db
    .prepare(
      `SELECT t.trip_id, t.route_id, t.headsign, st.arrival_time
       FROM stop_times st
       JOIN trips t ON t.trip_id = st.trip_id
       WHERE st.stop_id = ? AND t.service_id IN (${placeholders})`,
    )
    .all(params.stopId, ...activeServices) as Array<{
      trip_id: string;
      route_id: string;
      headsign: string;
      arrival_time: string;
    }>;

  const visits: ScheduledStopVisit[] = rows.map((r) => ({
    tripId: r.trip_id,
    routeId: r.route_id,
    stopId: params.stopId,
    scheduledTime: gtfsTimeToUnixSec(params.date, r.arrival_time),
    headsign: r.headsign,
  }));

  visits.sort((a, b) => a.scheduledTime - b.scheduledTime);

  if (params.nowSec === undefined) return visits;
  const min = params.nowSec - PAST_GRACE_SEC;
  const max =
    params.windowSec !== undefined ? params.nowSec + params.windowSec : Infinity;
  const count = params.count ?? DEFAULT_COUNT;
  return visits.filter((v) => v.scheduledTime >= min && v.scheduledTime <= max).slice(0, count);
}

/**
 * Route directions: one entry per unique headsign on the route, each
 * containing the stop IDs in stop_sequence order. Picks the longest
 * trip pattern per headsign as the canonical direction.
 *
 * Stop metadata (names, coordinates) is *not* included — the client
 * already has the stops table in memory and enriches the result.
 * Keeping the wire payload to just IDs makes responses compact.
 */
export function queryRouteDirections(
  db: Database.Database,
  routeId: string,
): RouteDirectionWire[] {
  // Per-trip stop counts so we can pick the longest pattern per headsign.
  const trips = db
    .prepare(
      `SELECT t.trip_id, t.headsign, COUNT(st.trip_id) AS n
       FROM trips t
       JOIN stop_times st ON st.trip_id = t.trip_id
       WHERE t.route_id = ?
       GROUP BY t.trip_id
       ORDER BY n DESC, t.trip_id`,
    )
    .all(routeId) as Array<{ trip_id: string; headsign: string; n: number }>;

  const canonicalByHeadsign = new Map<string, string>();
  for (const trip of trips) {
    if (!canonicalByHeadsign.has(trip.headsign)) {
      canonicalByHeadsign.set(trip.headsign, trip.trip_id);
    }
  }

  const directions: RouteDirectionWire[] = [];
  const stopsForTrip = db.prepare(
    'SELECT stop_id FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence',
  );
  for (const [headsign, tripId] of canonicalByHeadsign) {
    const stopRows = stopsForTrip.all(tripId) as Array<{ stop_id: string }>;
    directions.push({ headsign, stopIds: stopRows.map((r) => r.stop_id) });
  }
  return directions;
}
