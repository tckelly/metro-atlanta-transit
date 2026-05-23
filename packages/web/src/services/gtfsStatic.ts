/**
 * Runtime accessor for the preprocessed static GTFS bundle.
 *
 * The bundle ships as a small set of JSON files in /public/gtfs/, produced
 * at build time by the preprocessGtfs library (see ../buildtime/).
 *
 * The query layer here is pure: given a bundle, a stop, and a date, return
 * the scheduled visits the classifier can combine with realtime data.
 */

import type {
  GtfsBundle,
  StopOut,
  RouteOut,
} from '../buildtime/preprocessGtfs';
import type { ScheduledStopVisit } from '../features/stops/busRowClassifier';

const ATLANTA_TIMEZONE = 'America/New_York';

/**
 * Compute the millisecond offset of `date` in the given IANA timezone
 * relative to UTC. Positive when the zone is ahead of UTC (rare for the
 * Americas).
 */
function timezoneOffsetMillis(date: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : NaN;
  };
  // Intl returns hour 24 for midnight (non-standard); fold to 0.
  const hour = get('hour') === 24 ? 0 : get('hour');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asUtc - date.getTime();
}

/**
 * Convert a GTFS service-date + clock time to Unix seconds. The clock time
 * is in the agency's local timezone (Atlanta), and may exceed 24:00:00 for
 * trips that span midnight (per GTFS spec).
 *
 * @param serviceDate "YYYYMMDD"
 * @param gtfsTime "HH:MM:SS" with HH potentially >= 24
 * @param timeZone IANA timezone (default Atlanta)
 */
export function gtfsTimeToUnixSec(
  serviceDate: string,
  gtfsTime: string,
  timeZone: string = ATLANTA_TIMEZONE,
): number {
  if (!/^\d{8}$/.test(serviceDate)) {
    throw new Error(`Invalid service date: ${serviceDate}`);
  }
  // MARTA space-pads single-digit hours (" 6:07:50" instead of "06:07:50"),
  // so trim before matching the regex.
  const m = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(gtfsTime.trim());
  if (!m) throw new Error(`Invalid GTFS time: ${gtfsTime}`);

  const year = Number(serviceDate.substring(0, 4));
  const month = Number(serviceDate.substring(4, 6));
  const day = Number(serviceDate.substring(6, 8));
  const h = Number(m[1]);
  const minute = Number(m[2]);
  const second = Number(m[3]);

  const extraDays = Math.floor(h / 24);
  const localHour = h % 24;

  // Compute the UTC ms that *would* equal the local time if we treated
  // (year, month, day+extraDays, localHour, minute, second) as UTC, then
  // subtract the timezone offset at that moment to recover the real UTC ms.
  const utcMillisAsLocal = Date.UTC(year, month - 1, day + extraDays, localHour, minute, second);
  const offset = timezoneOffsetMillis(new Date(utcMillisAsLocal), timeZone);
  return Math.floor((utcMillisAsLocal - offset) / 1000);
}

/**
 * Return the set of service IDs active on the given date, per GTFS
 * calendar.txt rules plus calendar_dates.txt exceptions.
 *
 * @param date "YYYYMMDD"
 */
export function getActiveServiceIds(bundle: GtfsBundle, date: string): Set<string> {
  const result = new Set<string>();

  // Day-of-week index: Mon=0 .. Sun=6 (matching the bundle's weekdays tuple)
  // JS Date.getUTCDay returns 0=Sun..6=Sat — convert.
  const year = Number(date.substring(0, 4));
  const month = Number(date.substring(4, 6));
  const day = Number(date.substring(6, 8));
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const monIndex = (jsDay + 6) % 7;

  for (const rule of bundle.calendar.rules) {
    if (date < rule.startDate || date > rule.endDate) continue;
    if (rule.weekdays[monIndex]) result.add(rule.serviceId);
  }

  for (const exc of bundle.calendar.exceptions) {
    if (exc.date !== date) continue;
    if (exc.type === 'added') result.add(exc.serviceId);
    else result.delete(exc.serviceId);
  }

  return result;
}

/** Buses up to this many seconds in the past stay visible (just-passed grace). */
const PAST_GRACE_SEC = 60;
/** Default cap on number of upcoming visits returned. */
const DEFAULT_COUNT = 5;

export interface ScheduledVisitsWindow {
  /** Unix seconds — current time. When omitted, the function returns all visits for the day. */
  nowSec?: number;
  /** Maximum number of upcoming visits to return. Default 5. Only used when `nowSec` is provided. */
  count?: number;
  /**
   * Optional hard cap on how far ahead to look, in seconds. When omitted,
   * the only cap is `count`. Useful for "show buses in the next hour"
   * without surprises if a route has thousands of trips.
   */
  windowSec?: number;
}

/**
 * Return the scheduled visits at a stop on a given date, ordered by
 * scheduled time ascending. Output is ready for the classifier.
 *
 * When `nowSec` is supplied, the result is the next `count` upcoming
 * visits (with a small grace window for buses that just passed). Default
 * count is 5 — enough that the user always sees a useful answer if any
 * service runs today, no matter the time of day. An optional `windowSec`
 * adds a hard time cap on top.
 */
export function getScheduledVisitsForStop(
  bundle: GtfsBundle,
  stopId: string,
  date: string,
  window: ScheduledVisitsWindow = {},
): ScheduledStopVisit[] {
  const activeServices = getActiveServiceIds(bundle, date);

  const tripsById = new Map(bundle.trips.map((t) => [t.tripId, t]));

  const visits: ScheduledStopVisit[] = [];
  for (const st of bundle.stopTimes) {
    if (st.stopId !== stopId) continue;
    const trip = tripsById.get(st.tripId);
    if (!trip) continue;
    if (!activeServices.has(trip.serviceId)) continue;

    visits.push({
      tripId: trip.tripId,
      routeId: trip.routeId,
      stopId: st.stopId,
      scheduledTime: gtfsTimeToUnixSec(date, st.arrivalTime),
      headsign: trip.headsign,
    });
  }

  const sorted = visits.sort((a, b) => a.scheduledTime - b.scheduledTime);

  if (window.nowSec === undefined) return sorted;
  const min = window.nowSec - PAST_GRACE_SEC;
  const max = window.windowSec !== undefined ? window.nowSec + window.windowSec : Infinity;
  const count = window.count ?? DEFAULT_COUNT;
  return sorted.filter((v) => v.scheduledTime >= min && v.scheduledTime <= max).slice(0, count);
}

export function getStopMetadata(bundle: GtfsBundle, stopId: string): StopOut | undefined {
  return bundle.stops.find((s) => s.stopId === stopId);
}

export function getRouteMetadata(bundle: GtfsBundle, routeId: string): RouteOut | undefined {
  return bundle.routes.find((r) => r.routeId === routeId);
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(
      `Failed to load ${path}: ${res.status} ${res.statusText}. ` +
        `Did you run \`pnpm preprocess-gtfs\` to generate the static GTFS bundle?`,
    );
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch and parse the static GTFS bundle from /gtfs/. Designed to be called
 * once at app startup; the result is then passed into the query functions.
 *
 * The service worker (vite-plugin-pwa, forthcoming) will precache these
 * files, so after the first install this is a cache hit and resolves
 * immediately. Throws a descriptive error if the JSON files don't exist
 * (i.e., preprocess-gtfs hasn't been run).
 */
export async function loadGtfsBundle(): Promise<GtfsBundle> {
  const [stops, routes, trips, stopTimes, calendar] = await Promise.all([
    fetchJson<GtfsBundle['stops']>('/gtfs/stops.json'),
    fetchJson<GtfsBundle['routes']>('/gtfs/routes.json'),
    fetchJson<GtfsBundle['trips']>('/gtfs/trips.json'),
    fetchJson<GtfsBundle['stopTimes']>('/gtfs/stop-times.json'),
    fetchJson<GtfsBundle['calendar']>('/gtfs/calendar.json'),
  ]);
  return { stops, routes, trips, stopTimes, calendar };
}
