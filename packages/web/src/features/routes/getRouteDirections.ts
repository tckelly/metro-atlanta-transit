/**
 * Enumerate the headsign-grouped stop patterns for a route.
 *
 * MARTA routes typically have two main headsigns (outbound + inbound)
 * and one or more shorter "turn-back" variants that share a headsign
 * but stop early. For browse-by-route we want the rider's mental model:
 * one stop list per direction. So per headsign we pick the trip with
 * the longest stop sequence as the canonical pattern, then list its
 * stops in `stop_sequence` order.
 *
 * Pure over the bundle so this is trivially testable and memoizable.
 */
import type { GtfsBundle, StopOut, StopTimeOut } from '../../buildtime/preprocessGtfs';

export interface RouteDirection {
  headsign: string;
  stops: StopOut[];
}

export function getRouteDirections(bundle: GtfsBundle, routeId: string): RouteDirection[] {
  const tripsForRoute = bundle.trips.filter((t) => t.routeId === routeId);
  if (tripsForRoute.length === 0) return [];

  const tripsByHeadsign = new Map<string, string[]>();
  for (const trip of tripsForRoute) {
    let bucket = tripsByHeadsign.get(trip.headsign);
    if (bucket === undefined) {
      bucket = [];
      tripsByHeadsign.set(trip.headsign, bucket);
    }
    bucket.push(trip.tripId);
  }

  const stopTimesByTrip = new Map<string, StopTimeOut[]>();
  for (const st of bundle.stopTimes) {
    let bucket = stopTimesByTrip.get(st.tripId);
    if (bucket === undefined) {
      bucket = [];
      stopTimesByTrip.set(st.tripId, bucket);
    }
    bucket.push(st);
  }

  const stopsById = new Map(bundle.stops.map((s) => [s.stopId, s]));

  const directions: RouteDirection[] = [];
  for (const [headsign, tripIds] of tripsByHeadsign) {
    let best: StopTimeOut[] = [];
    for (const tripId of tripIds) {
      const sts = stopTimesByTrip.get(tripId) ?? [];
      if (sts.length > best.length) best = sts;
    }
    const ordered = [...best].sort((a, b) => a.stopSequence - b.stopSequence);
    const stops = ordered
      .map((st) => stopsById.get(st.stopId))
      .filter((s): s is StopOut => s !== undefined);
    directions.push({ headsign, stops });
  }

  return directions;
}
