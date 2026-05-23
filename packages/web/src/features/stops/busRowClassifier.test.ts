import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { decodeTripUpdates, type TripUpdate } from '@atl-transit/gtfs';

import { classifyBusRows, type ScheduledStopVisit } from './busRowClassifier';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../../../sample-data/marta-gtfs-rt-2026-05-22/tu.pb');
const tuBytes = new Uint8Array(readFileSync(fixturePath));
const realTripUpdates = decodeTripUpdates(tuBytes).trips;

// Build a synthetic TripUpdate for fabricated cases.
function fakeTrip(overrides: Partial<TripUpdate>): TripUpdate {
  return {
    tripId: 'FAKE',
    routeId: 'FAKE_ROUTE',
    scheduleRelationship: 'SCHEDULED',
    stopTimeUpdates: [],
    ...overrides,
  };
}

describe('classifyBusRows', () => {
  it('marks a SCHEDULED trip with an arrival prediction as live, computing delay', () => {
    // Real trip 10802068, scheduled to arrive at stop 134013 at 1779468116,
    // predicted to arrive at 1779467993 (123 sec early).
    const scheduledVisits: ScheduledStopVisit[] = [
      {
        tripId: '10802068',
        routeId: '116',
        stopId: '134013',
        scheduledTime: 1779468116,
        headsign: 'Decatur Station',
      },
    ];
    const rows = classifyBusRows({
      scheduledVisits,
      tripUpdates: realTripUpdates,
      stopId: '134013',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tripId: '10802068',
      routeId: '116',
      scheduledTime: 1779468116,
      headsign: 'Decatur Station',
      status: 'live',
      predictedTime: 1779467993,
      delaySec: -123,
    });
  });

  it('marks a CANCELED trip as cancelled', () => {
    // Real trip 10807633 is CANCELED in the fixture.
    const scheduledVisits: ScheduledStopVisit[] = [
      {
        tripId: '10807633',
        routeId: '182',
        stopId: '213374',
        scheduledTime: 1779471600,
        headsign: 'Wherever',
      },
    ];
    const rows = classifyBusRows({
      scheduledVisits,
      tripUpdates: realTripUpdates,
      stopId: '213374',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('cancelled');
    expect(rows[0]?.predictedTime).toBeUndefined();
    expect(rows[0]?.delaySec).toBeUndefined();
    expect(rows[0]?.scheduledTime).toBe(1779471600);
  });

  it('marks a scheduled visit with no matching trip update as no_live_data', () => {
    const scheduledVisits: ScheduledStopVisit[] = [
      {
        tripId: 'TRIP_NOT_IN_FEED',
        routeId: '99',
        stopId: '134013',
        scheduledTime: 1779470000,
        headsign: 'Somewhere',
      },
    ];
    const rows = classifyBusRows({
      scheduledVisits,
      tripUpdates: [],
      stopId: '134013',
    });

    expect(rows[0]?.status).toBe('no_live_data');
    expect(rows[0]?.predictedTime).toBeUndefined();
  });

  it('marks a scheduled visit as no_live_data when the matching trip has no update for this stop', () => {
    const scheduledVisits: ScheduledStopVisit[] = [
      {
        tripId: '10802068',
        routeId: '116',
        stopId: 'STOP_NOT_ON_THIS_TRIP',
        scheduledTime: 1779468116,
        headsign: 'Decatur Station',
      },
    ];
    const rows = classifyBusRows({
      scheduledVisits,
      tripUpdates: realTripUpdates,
      stopId: 'STOP_NOT_ON_THIS_TRIP',
    });

    expect(rows[0]?.status).toBe('no_live_data');
  });

  it('marks a SCHEDULED trip with a SKIPPED stop as cancelled at this stop', () => {
    // Fabricate: the trip is running but skipping our stop.
    const tripUpdates: TripUpdate[] = [
      fakeTrip({
        tripId: 'TRIP_SKIPS_US',
        routeId: '36',
        scheduleRelationship: 'SCHEDULED',
        stopTimeUpdates: [
          {
            stopSequence: 1,
            stopId: 'OUR_STOP',
            scheduleRelationship: 'SKIPPED',
          },
        ],
      }),
    ];
    const scheduledVisits: ScheduledStopVisit[] = [
      {
        tripId: 'TRIP_SKIPS_US',
        routeId: '36',
        stopId: 'OUR_STOP',
        scheduledTime: 1779470000,
        headsign: 'Decatur Station',
      },
    ];

    const rows = classifyBusRows({ scheduledVisits, tripUpdates, stopId: 'OUR_STOP' });
    expect(rows[0]?.status).toBe('cancelled');
  });

  it('returns rows sorted by scheduled time ascending', () => {
    const scheduledVisits: ScheduledStopVisit[] = [
      { tripId: 'A', routeId: '1', stopId: 'X', scheduledTime: 1779470000, headsign: 'X' },
      { tripId: 'B', routeId: '1', stopId: 'X', scheduledTime: 1779468000, headsign: 'X' },
      { tripId: 'C', routeId: '1', stopId: 'X', scheduledTime: 1779469000, headsign: 'X' },
    ];
    const rows = classifyBusRows({ scheduledVisits, tripUpdates: [], stopId: 'X' });
    expect(rows.map((r) => r.scheduledTime)).toEqual([1779468000, 1779469000, 1779470000]);
  });
});
