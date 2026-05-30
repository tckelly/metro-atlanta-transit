/**
 * Live-path adapter: a GTFS-RT TripUpdate's stop_time_updates become
 * a TripStop[] for the BusRowDisclosure.
 *
 * Re-uses the same `TripStop` shape the scheduled (backend) path
 * produces, but populates the optional `predictedArrivalTime` and
 * `isSkipped` fields so the disclosure can render richer info when the
 * realtime feed has it.
 *
 * Sorts defensively by stopSequence: the GTFS-RT spec doesn't promise
 * ordered stop_time_updates, and downstream slicing assumes order.
 */
import type { TripUpdate } from '@atl-transit/gtfs';

import type { TripStop } from './downstreamStops';

export function liveTripUpdateToTripStops(update: TripUpdate): TripStop[] {
  const stops: TripStop[] = update.stopTimeUpdates.map((stu) => {
    const stop: TripStop = {
      stopId: stu.stopId,
      stopSequence: stu.stopSequence,
    };
    if (stu.arrivalTime !== undefined) stop.predictedArrivalTime = stu.arrivalTime;
    if (stu.scheduleRelationship === 'SKIPPED') stop.isSkipped = true;
    return stop;
  });
  return stops.sort((a, b) => a.stopSequence - b.stopSequence);
}
