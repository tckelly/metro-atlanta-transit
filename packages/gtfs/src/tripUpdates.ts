import gtfs from 'gtfs-realtime-bindings';

import { TripUpdatesFeedSchema, type TripUpdatesFeed } from './types';

const { FeedMessage } = gtfs.transit_realtime;

/**
 * Decode a MARTA GTFS-Realtime trip_updates payload into our internal domain shape.
 *
 * The protobuf decoder produces a loose object (Longs, enum integers, optional
 * everywhere). We reshape into a strict JS-native form and validate with Zod
 * before returning, so callers get a known-good `TripUpdatesFeed`.
 *
 * Throws on:
 * - Unparseable protobuf input
 * - Missing required fields (header timestamp, trip/route IDs)
 * - Enum values outside the GTFS-Realtime spec
 */
export function decodeTripUpdates(bytes: Uint8Array): TripUpdatesFeed {
  const message = FeedMessage.decode(bytes);
  const obj = FeedMessage.toObject(message, {
    enums: String,
    longs: Number,
    defaults: false,
  });

  const feedTimestamp = obj.header?.timestamp;
  if (typeof feedTimestamp !== 'number') {
    throw new Error('decodeTripUpdates: feed header.timestamp is missing or not numeric');
  }

  const trips: unknown[] = [];

  for (const entity of obj.entity ?? []) {
    const tu = entity.tripUpdate;
    if (!tu) continue;

    const trip = tu.trip;
    if (!trip?.tripId || !trip.routeId) continue;

    const stopTimeUpdates: unknown[] = [];
    for (const stu of tu.stopTimeUpdate ?? []) {
      if (typeof stu.stopSequence !== 'number' || !stu.stopId) continue;
      stopTimeUpdates.push({
        stopSequence: stu.stopSequence,
        stopId: stu.stopId,
        scheduleRelationship: stu.scheduleRelationship ?? 'SCHEDULED',
        arrivalTime: stu.arrival?.time,
        arrivalScheduledTime: stu.arrival?.scheduledTime,
        departureTime: stu.departure?.time,
        departureScheduledTime: stu.departure?.scheduledTime,
      });
    }

    trips.push({
      tripId: trip.tripId,
      routeId: trip.routeId,
      startTime: trip.startTime,
      startDate: trip.startDate,
      directionId: trip.directionId,
      scheduleRelationship: trip.scheduleRelationship ?? 'SCHEDULED',
      vehicleId: tu.vehicle?.id,
      vehicleLabel: tu.vehicle?.label,
      timestamp: tu.timestamp,
      stopTimeUpdates,
    });
  }

  return TripUpdatesFeedSchema.parse({ feedTimestamp, trips });
}
