/**
 * `GtfsRepository` backed by a fully-loaded in-memory bundle.
 *
 * This is the legacy implementation made interface-compliant — every
 * call delegates to existing pure helpers in `gtfsStatic.ts`,
 * `getNearbyStops`, and `getRouteDirections`. Tests for those modules
 * cover the behavior; this class is the thin adapter that exposes
 * them through the `GtfsRepository` contract.
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
import {
  getRouteMetadata,
  getScheduledVisitsForStop,
  getStopMetadata,
} from '../gtfsStatic';
import type { GtfsRepository, ScheduledVisitsQuery } from './GtfsRepository';

export class InMemoryGtfsRepository implements GtfsRepository {
  constructor(private readonly bundle: GtfsBundle) {}

  getStop(stopId: string): StopOut | undefined {
    return getStopMetadata(this.bundle, stopId);
  }

  getRoute(routeId: string): RouteOut | undefined {
    return getRouteMetadata(this.bundle, routeId);
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
}
