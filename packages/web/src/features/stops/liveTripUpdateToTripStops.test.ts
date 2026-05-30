import { describe, it, expect } from 'vitest';
import type { TripUpdate } from '@atl-transit/gtfs';

import { liveTripUpdateToTripStops } from './liveTripUpdateToTripStops';

function makeUpdate(
  stopTimeUpdates: TripUpdate['stopTimeUpdates'],
): TripUpdate {
  return {
    tripId: 'T1',
    routeId: '116',
    scheduleRelationship: 'SCHEDULED',
    stopTimeUpdates,
  };
}

describe('liveTripUpdateToTripStops', () => {
  it('maps each stop_time_update to a TripStop with id + sequence', () => {
    const stops = liveTripUpdateToTripStops(
      makeUpdate([
        { stopSequence: 1, stopId: 'A', scheduleRelationship: 'SCHEDULED' },
        { stopSequence: 2, stopId: 'B', scheduleRelationship: 'SCHEDULED' },
      ]),
    );
    expect(stops).toEqual([
      { stopId: 'A', stopSequence: 1 },
      { stopId: 'B', stopSequence: 2 },
    ]);
  });

  it('attaches predictedArrivalTime when the realtime update has one', () => {
    const stops = liveTripUpdateToTripStops(
      makeUpdate([
        {
          stopSequence: 1,
          stopId: 'A',
          scheduleRelationship: 'SCHEDULED',
          arrivalTime: 1767611400,
        },
      ]),
    );
    expect(stops[0]).toEqual({
      stopId: 'A',
      stopSequence: 1,
      predictedArrivalTime: 1767611400,
    });
  });

  it('flags isSkipped when scheduleRelationship is SKIPPED', () => {
    const stops = liveTripUpdateToTripStops(
      makeUpdate([
        { stopSequence: 1, stopId: 'A', scheduleRelationship: 'SCHEDULED' },
        { stopSequence: 2, stopId: 'B', scheduleRelationship: 'SKIPPED' },
        { stopSequence: 3, stopId: 'C', scheduleRelationship: 'SCHEDULED' },
      ]),
    );
    expect(stops[1]?.isSkipped).toBe(true);
    expect(stops[0]?.isSkipped).toBeUndefined();
    expect(stops[2]?.isSkipped).toBeUndefined();
  });

  it('sorts by stopSequence even when the feed delivers them out of order', () => {
    // GTFS-RT does not guarantee sorted stop_time_updates. The recon
    // shows MARTA orders them, but the schema doesn't, and we depend
    // on order downstream when slicing — sort defensively.
    const stops = liveTripUpdateToTripStops(
      makeUpdate([
        { stopSequence: 3, stopId: 'C', scheduleRelationship: 'SCHEDULED' },
        { stopSequence: 1, stopId: 'A', scheduleRelationship: 'SCHEDULED' },
        { stopSequence: 2, stopId: 'B', scheduleRelationship: 'SCHEDULED' },
      ]),
    );
    expect(stops.map((s) => s.stopId)).toEqual(['A', 'B', 'C']);
  });

  it('returns an empty array when the trip has no stop_time_updates', () => {
    expect(liveTripUpdateToTripStops(makeUpdate([]))).toEqual([]);
  });
});
