/**
 * Abstract data-access layer for GTFS static data.
 *
 * Consumers depend on this interface, never on the underlying storage
 * (in-memory JSON bundle, backend SQLite via HTTP, etc.). Swapping the
 * concrete implementation in `App.tsx` is the only place the choice
 * lives — see the InMemoryGtfsRepository and HybridGtfsRepository
 * sibling modules, and ADR-0006 for the why.
 *
 * Interface shape: **mixed sync/async**. Small reference data (a stop's
 * name, a route's short-name) is sync because it ships small enough to
 * live in memory and async-everywhere would ripple loading/error
 * states through every render. Genuinely-expensive queries (stop-times
 * for a stop on a date, all directions for a route, nearby stops) are
 * async — that's the seam where a future backend can plug in without
 * touching consumers.
 *
 * If we ever decide stops/routes should also come from the backend,
 * the sync methods become async — a real refactor by design, because
 * it's a real architectural shift that consumers should be re-examined
 * for (loading skeletons, error states).
 */
import type { LatLng } from '../../utils/haversine';
import type { StopOut, RouteOut } from '../../buildtime/preprocessGtfs';
import type { ScheduledStopVisit } from '../../features/stops/busRowClassifier';
import type { NearbyStop } from '../../features/nearby/getNearbyStops';
import type { RouteDirection } from '../../features/routes/getRouteDirections';
import type { TripStop } from '../../features/stops/downstreamStops';

export interface ScheduledVisitsQuery {
  stopId: string;
  /** GTFS service date "YYYYMMDD". */
  date: string;
  /**
   * Unix seconds — current time. When omitted, all visits for the day
   * are returned. When provided, the result is sliced to the next
   * `count` upcoming visits (with a small past-grace window).
   */
  nowSec?: number;
  /** Maximum upcoming visits to return when `nowSec` is supplied. Default 5. */
  count?: number;
  /**
   * Hard ceiling on how far ahead to look, in seconds. Useful for
   * "show buses in the next hour" semantics.
   */
  windowSec?: number;
}

export interface GtfsRepository {
  // -------------------------------------------------------------------
  // Sync metadata — small reference data assumed to be in memory.
  // Implementations must not block to fulfill these.
  // -------------------------------------------------------------------

  /** Return the stop with this id, or `undefined` if unknown. */
  getStop(stopId: string): StopOut | undefined;

  /** Return the route with this id, or `undefined` if unknown. */
  getRoute(routeId: string): RouteOut | undefined;

  /** All known stops. Used for naturally-sorted browse pages. */
  listStops(): readonly StopOut[];

  /** All known routes. Used for naturally-sorted browse pages. */
  listRoutes(): readonly RouteOut[];

  // -------------------------------------------------------------------
  // Async queries — may be backed by an HTTP backend in production.
  // -------------------------------------------------------------------

  /**
   * Scheduled stop-visit list at a stop on a given date.
   *
   * Implementations may filter and slice on the server side when the
   * underlying storage supports it; the contract here only describes
   * the shape of the result.
   */
  getScheduledVisitsForStop(query: ScheduledVisitsQuery): Promise<ScheduledStopVisit[]>;

  /**
   * The ordered stop sequence for each unique headsign on a route.
   * Used by the route-detail browse page.
   */
  getRouteDirections(routeId: string): Promise<RouteDirection[]>;

  /**
   * The `count` stops nearest to `position`, ranked by great-circle
   * distance. Result is sorted ascending and each entry is augmented
   * with `distanceMeters`.
   */
  findNearbyStops(position: LatLng, count: number): Promise<NearbyStop[]>;

  /**
   * The full ordered stop pattern for a single trip on `date` — used
   * by the downstream-stops disclosure on the stop-detail page to
   * render "where this bus is going next" when the rider taps an
   * arrival.
   *
   * Live rows on the stop-detail page derive their downstream stops
   * from the realtime feed directly; this method is the scheduled-
   * path fallback for arrivals that have no live trip update. Each
   * stop carries `scheduledTime` (Unix seconds), so the disclosure
   * can show clock times without a second round-trip.
   */
  getStopsForTrip(tripId: string, date: string): Promise<TripStop[]>;
}
