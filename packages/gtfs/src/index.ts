export { decodeTripUpdates } from './tripUpdates';
export { decodeVehiclePositions } from './vehiclePositions';
export { decodeAlerts } from './alerts';

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
} from './types';

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
} from './types';
