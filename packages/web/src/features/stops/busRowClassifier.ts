import type { OccupancyStatus, TripUpdate, VehiclePosition } from '@atl-transit/gtfs';

/**
 * Status of a single scheduled bus at a stop. Carries the "show all buses,
 * label what's broken" UX principle (see docs/personas-and-jobs.md).
 *
 * - `live` — real-time prediction available; show ETA and delay.
 * - `cancelled` — trip is cancelled OR the specific stop is being skipped.
 * - `no_live_data` — scheduled bus, but no prediction for this stop.
 */
export type BusRowStatus = 'live' | 'cancelled' | 'no_live_data';

/**
 * A single scheduled visit of a trip to a stop. Sourced from the
 * preprocessed static GTFS bundle.
 */
export interface ScheduledStopVisit {
  tripId: string;
  routeId: string;
  stopId: string;
  /** Unix seconds — the published scheduled arrival time at this stop. */
  scheduledTime: number;
  /** Human-readable destination, e.g., "Decatur Station". */
  headsign: string;
}

/**
 * A classified bus row, ready for the domain-to-visual mapper in
 * `busRowMapper.ts` to convert to component props.
 */
export interface ClassifiedBusRow {
  tripId: string;
  routeId: string;
  scheduledTime: number;
  headsign: string;
  status: BusRowStatus;
  /** Predicted arrival, present only when `status === 'live'`. */
  predictedTime?: number;
  /** predictedTime - scheduledTime; negative if ahead of schedule. */
  delaySec?: number;
  /**
   * Vehicle-reported occupancy, present only when `status === 'live'` AND
   * a matching VehiclePosition reports `occupancyStatus`. About 55% of
   * in-progress MARTA buses report this — see docs/data-and-apis.md.
   */
  occupancy?: OccupancyStatus;
}

export interface ClassifyInput {
  scheduledVisits: ScheduledStopVisit[];
  tripUpdates: TripUpdate[];
  vehiclePositions: VehiclePosition[];
  stopId: string;
}

/**
 * Combine scheduled visits (from static GTFS) with realtime trip updates
 * to produce a list of classified bus rows for a single stop. Order is
 * by scheduled time, ascending. Length matches `scheduledVisits.length` —
 * no scheduled bus is ever silently dropped.
 */
export function classifyBusRows(input: ClassifyInput): ClassifiedBusRow[] {
  const { scheduledVisits, tripUpdates, vehiclePositions, stopId } = input;
  const updatesByTripId = new Map(tripUpdates.map((t) => [t.tripId, t]));
  const vehiclesByTripId = new Map(vehiclePositions.map((v) => [v.tripId, v]));

  const rows = scheduledVisits.map((visit): ClassifiedBusRow => {
    const baseRow = {
      tripId: visit.tripId,
      routeId: visit.routeId,
      scheduledTime: visit.scheduledTime,
      headsign: visit.headsign,
    };

    const update = updatesByTripId.get(visit.tripId);

    if (!update) {
      return { ...baseRow, status: 'no_live_data' };
    }

    if (update.scheduleRelationship === 'CANCELED') {
      return { ...baseRow, status: 'cancelled' };
    }

    const stopUpdate = update.stopTimeUpdates.find((s) => s.stopId === stopId);

    if (stopUpdate?.scheduleRelationship === 'SKIPPED') {
      return { ...baseRow, status: 'cancelled' };
    }

    if (stopUpdate?.arrivalTime !== undefined) {
      const occupancy = vehiclesByTripId.get(visit.tripId)?.occupancyStatus;
      return {
        ...baseRow,
        status: 'live',
        predictedTime: stopUpdate.arrivalTime,
        delaySec: stopUpdate.arrivalTime - visit.scheduledTime,
        ...(occupancy !== undefined ? { occupancy } : {}),
      };
    }

    return { ...baseRow, status: 'no_live_data' };
  });

  return rows.sort((a, b) => a.scheduledTime - b.scheduledTime);
}
