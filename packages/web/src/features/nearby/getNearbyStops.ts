/**
 * Rank GTFS stops by physical distance from a position and return the
 * nearest N. Pure over `(bundle, position, count)` so the function is
 * trivially testable and reusable across the home, route detail, and
 * (eventually) any "stops on this map" view.
 */
import { haversineMeters, type LatLng } from '../../utils/haversine';
import type { GtfsBundle, StopOut } from '../../buildtime/preprocessGtfs';

export interface NearbyStop extends StopOut {
  /** Straight-line distance from the query position, in meters. */
  distanceMeters: number;
}

export function getNearbyStops(
  bundle: GtfsBundle,
  position: LatLng,
  count: number,
): NearbyStop[] {
  if (count <= 0) return [];

  const ranked: NearbyStop[] = bundle.stops.map((stop) => ({
    ...stop,
    distanceMeters: haversineMeters(position, { lat: stop.lat, lng: stop.lng }),
  }));
  ranked.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return ranked.slice(0, count);
}
