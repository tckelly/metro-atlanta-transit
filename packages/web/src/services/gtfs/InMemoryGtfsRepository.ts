/**
 * `GtfsRepository` backed by a fully-loaded in-memory bundle.
 *
 * Async methods delegate to pure helpers in `gtfsStatic.ts`,
 * `getNearbyStops`, and `getRouteDirections`. Sync metadata reads use
 * Map indexes built once in the constructor — the bundle is immutable
 * for the lifetime of the repo instance, so the maps are valid forever.
 *
 * Async methods resolve immediately — wrapping with `async` is free
 * here, and matters because production may swap in a backend impl
 * where these are real network calls.
 */
import type { LatLng } from '../../utils/haversine';
import type { GtfsBundle, RouteOut, StopOut } from '../../buildtime/preprocessGtfs';
import type { ScheduledStopVisit } from '../../features/stops/busRowClassifier';
import { getNearbyStops, type NearbyStop } from '../../features/nearby/getNearbyStops';
import {
  getRouteDirections,
  type RouteDirection,
} from '../../features/routes/getRouteDirections';
import type { TripStop } from '../../features/stops/downstreamStops';
import { getScheduledVisitsForStop } from '../gtfsStatic';
import type { GtfsRepository, ScheduledVisitsQuery } from './GtfsRepository';

export class InMemoryGtfsRepository implements GtfsRepository {
  private readonly stopsById: Map<string, StopOut>;
  private readonly routesById: Map<string, RouteOut>;

  constructor(private readonly bundle: GtfsBundle) {
    this.stopsById = new Map(bundle.stops.map((s) => [s.stopId, s]));
    this.routesById = new Map(bundle.routes.map((r) => [r.routeId, r]));
  }

  getStop(stopId: string): StopOut | undefined {
    return this.stopsById.get(stopId);
  }

  getRoute(routeId: string): RouteOut | undefined {
    return this.routesById.get(routeId);
  }

  listStops(): readonly StopOut[] {
    return this.bundle.stops;
  }

  listRoutes(): readonly RouteOut[] {
    return this.bundle.routes;
  }

  async getScheduledVisitsForStop(query: ScheduledVisitsQuery): Promise<ScheduledStopVisit[]> {
    const window: { nowSec?: number; count?: number; windowSec?: number } = {};
    if (query.nowSec !== undefined) window.nowSec = query.nowSec;
    if (query.count !== undefined) window.count = query.count;
    if (query.windowSec !== undefined) window.windowSec = query.windowSec;
    return getScheduledVisitsForStop(this.bundle, query.stopId, query.date, window);
  }

  async getRouteDirections(routeId: string): Promise<RouteDirection[]> {
    return getRouteDirections(this.bundle, routeId);
  }

  async findNearbyStops(position: LatLng, count: number): Promise<NearbyStop[]> {
    return getNearbyStops(this.bundle, position, count);
  }

  async getStopsForTrip(tripId: string): Promise<TripStop[]> {
    return this.bundle.stopTimes
      .filter((st) => st.tripId === tripId)
      .sort((a, b) => a.stopSequence - b.stopSequence)
      .map((st) => ({ stopId: st.stopId, stopSequence: st.stopSequence }));
  }
}
