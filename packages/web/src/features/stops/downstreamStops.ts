/**
 * A single stop in a trip's ordered pattern.
 *
 * Identified by `stopSequence` rather than `stopId` so callers can
 * slice unambiguously even on loop routes where the same `stopId`
 * appears twice in a single trip. (MARTA doesn't run loops today,
 * but GTFS allows them — sequence is the truthful key.)
 *
 * `predictedArrivalTime` and `isSkipped` are optional enrichment from
 * the live realtime path (`liveTripUpdateToTripStops`); the scheduled
 * backend path leaves them undefined but carries `scheduledTime` so
 * the disclosure can render clock times for both paths from a single
 * shape.
 */
export interface TripStop {
  stopId: string;
  stopSequence: number;
  /** Static-schedule arrival in Unix seconds — scheduled path only. */
  scheduledTime?: number;
  /** Predicted arrival time in Unix seconds — live path only. */
  predictedArrivalTime?: number;
  /** True when the live trip update marks this stop SKIPPED for this trip. */
  isSkipped?: boolean;
}

/**
 * Return the portion of a trip's stop pattern strictly after the
 * rider's current position. Used by the BusRowDisclosure to show
 * "where this bus is going next" when the rider expands an arrival.
 *
 * Generic over the stop shape so live-path enrichment (predicted
 * arrival times, SKIPPED flags) survives the slice without an
 * extra unwrap step.
 */
export function downstreamStops<T extends TripStop>(
  tripStops: readonly T[],
  currentStopSequence: number,
): T[] {
  return tripStops.filter((s) => s.stopSequence > currentStopSequence);
}
