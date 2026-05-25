/**
 * `GtfsRepository` for production: small reference data in memory,
 * big queries (stop-times, route-directions) over HTTP to the
 * Vercel Node functions. Per ADR-0006.
 *
 * Sync methods read from the bundle directly — fast, no awaits ripple
 * through the UI. Async methods serialize their inputs into a URL
 * search string, fetch, and Zod-validate the response (CLAUDE.md
 * requires it for any external data, including our own backend).
 *
 * `findNearbyStops` stays client-side: the stops table is already in
 * memory and the haversine ranking is trivial. Async on the interface
 * because the backend might do this in the future.
 */
import { z } from 'zod';

import { haversineMeters, type LatLng } from '../../utils/haversine';
import type { RouteOut, StopOut } from '../../buildtime/preprocessGtfs';
import type { ScheduledStopVisit } from '../../features/stops/busRowClassifier';
import type { NearbyStop } from '../../features/nearby/getNearbyStops';
import type { RouteDirection } from '../../features/routes/getRouteDirections';
import type { GtfsRepository, ScheduledVisitsQuery } from './GtfsRepository';

export interface SmallGtfsBundle {
  stops: StopOut[];
  routes: RouteOut[];
}

export interface HybridGtfsConfig {
  bundle: SmallGtfsBundle;
  /** Override the fetch implementation (tests). Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
  /** Prefix for the backend URLs. Defaults to '' (same origin). */
  baseUrl?: string;
}

const ScheduledStopVisitSchema = z.object({
  tripId: z.string(),
  routeId: z.string(),
  stopId: z.string(),
  scheduledTime: z.number(),
  headsign: z.string(),
});

const ScheduledStopVisitsResponseSchema = z.array(ScheduledStopVisitSchema);

const RouteDirectionWireSchema = z.object({
  headsign: z.string(),
  stopIds: z.array(z.string()),
});

const RouteDirectionsResponseSchema = z.array(RouteDirectionWireSchema);

export class HybridGtfsRepository implements GtfsRepository {
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(private readonly config: HybridGtfsConfig) {
    // Bind to globalThis so the global fetch isn't invoked with `this`
    // pointing at the repository instance — `Window.fetch` rejects any
    // other receiver with "Illegal invocation."
    const provided = config.fetch ?? globalThis.fetch;
    this.fetchFn = provided.bind(globalThis);
  }

  private get baseUrl(): string {
    return this.config.baseUrl ?? '';
  }

  getStop(stopId: string): StopOut | undefined {
    return this.config.bundle.stops.find((s) => s.stopId === stopId);
  }

  getRoute(routeId: string): RouteOut | undefined {
    return this.config.bundle.routes.find((r) => r.routeId === routeId);
  }

  listStops(): readonly StopOut[] {
    return this.config.bundle.stops;
  }

  listRoutes(): readonly RouteOut[] {
    return this.config.bundle.routes;
  }

  async getScheduledVisitsForStop(
    query: ScheduledVisitsQuery,
  ): Promise<ScheduledStopVisit[]> {
    const params = new URLSearchParams({ stopId: query.stopId, date: query.date });
    if (query.nowSec !== undefined) params.set('nowSec', String(query.nowSec));
    if (query.count !== undefined) params.set('count', String(query.count));
    if (query.windowSec !== undefined) params.set('windowSec', String(query.windowSec));

    const res = await this.fetchFn(`${this.baseUrl}/api/gtfs/stop-times?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`stop-times failed: ${res.status} ${res.statusText}`);
    }
    return ScheduledStopVisitsResponseSchema.parse(await res.json());
  }

  async getRouteDirections(routeId: string): Promise<RouteDirection[]> {
    const params = new URLSearchParams({ routeId });
    const res = await this.fetchFn(
      `${this.baseUrl}/api/gtfs/route-directions?${params.toString()}`,
    );
    if (!res.ok) {
      throw new Error(`route-directions failed: ${res.status} ${res.statusText}`);
    }
    const wire = RouteDirectionsResponseSchema.parse(await res.json());
    return wire.map((d) => ({
      headsign: d.headsign,
      stops: d.stopIds
        .map((id) => this.getStop(id))
        .filter((s): s is StopOut => s !== undefined),
    }));
  }

  async findNearbyStops(position: LatLng, count: number): Promise<NearbyStop[]> {
    if (count <= 0) return [];
    const ranked: NearbyStop[] = this.config.bundle.stops.map((stop) => ({
      ...stop,
      distanceMeters: haversineMeters(position, { lat: stop.lat, lng: stop.lng }),
    }));
    ranked.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return ranked.slice(0, count);
  }
}
