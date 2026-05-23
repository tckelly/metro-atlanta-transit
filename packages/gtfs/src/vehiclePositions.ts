import gtfs from 'gtfs-realtime-bindings';

import { VehiclePositionsFeedSchema, type VehiclePositionsFeed } from './types';

const { FeedMessage } = gtfs.transit_realtime;

/**
 * Decode a MARTA GTFS-Realtime vehicle_positions payload into our internal
 * domain shape. See decodeTripUpdates for the general pattern.
 *
 * Throws on:
 * - Unparseable protobuf input
 * - Missing required fields (header timestamp, position, vehicle/trip IDs)
 * - Enum values outside the GTFS-Realtime spec
 */
export function decodeVehiclePositions(bytes: Uint8Array): VehiclePositionsFeed {
  const message = FeedMessage.decode(bytes);
  const obj = FeedMessage.toObject(message, {
    enums: String,
    longs: Number,
    defaults: false,
  });

  const feedTimestamp = obj.header?.timestamp;
  if (typeof feedTimestamp !== 'number') {
    throw new Error('decodeVehiclePositions: feed header.timestamp is missing or not numeric');
  }

  const vehicles: unknown[] = [];

  for (const entity of obj.entity ?? []) {
    const vp = entity.vehicle;
    if (!vp) continue;

    const vehicleId = vp.vehicle?.id;
    const tripId = vp.trip?.tripId;
    const routeId = vp.trip?.routeId;
    const lat = vp.position?.latitude;
    const lon = vp.position?.longitude;
    const ts = vp.timestamp;

    if (!vehicleId || !tripId || !routeId) continue;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    if (typeof ts !== 'number') continue;

    vehicles.push({
      vehicleId,
      vehicleLabel: vp.vehicle?.label,
      tripId,
      routeId,
      startDate: vp.trip?.startDate,
      latitude: lat,
      longitude: lon,
      bearing: vp.position?.bearing,
      speed: vp.position?.speed,
      timestamp: ts,
      occupancyStatus: vp.occupancyStatus,
      occupancyPercentage: vp.occupancyPercentage,
    });
  }

  return VehiclePositionsFeedSchema.parse({ feedTimestamp, vehicles });
}
