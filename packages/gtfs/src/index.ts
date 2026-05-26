export { decodeTripUpdates } from './tripUpdates.js';
export { decodeVehiclePositions } from './vehiclePositions.js';
export { decodeAlerts } from './alerts.js';

export {
  // Trip updates
  TripUpdatesFeedSchema,
  TripUpdateSchema,
  StopTimeUpdateSchema,
  TripScheduleRelationshipSchema,
  StopScheduleRelationshipSchema,
  // Vehicle positions
  VehiclePositionsFeedSchema,
  VehiclePositionSchema,
  OccupancyStatusSchema,
  // Alerts
  AlertsFeedSchema,
  AlertSchema,
  AlertCauseSchema,
  AlertEffectSchema,
  TimeRangeSchema,
} from './types.js';

export type {
  // Trip updates
  TripUpdatesFeed,
  TripUpdate,
  StopTimeUpdate,
  TripScheduleRelationship,
  StopScheduleRelationship,
  // Vehicle positions
  VehiclePositionsFeed,
  VehiclePosition,
  OccupancyStatus,
  // Alerts
  AlertsFeed,
  Alert,
  AlertCause,
  AlertEffect,
  TimeRange,
} from './types.js';
