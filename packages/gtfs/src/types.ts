import { z } from 'zod';

// ---------------- Trip Updates ----------------

// Per GTFS-Realtime spec, TripDescriptor.ScheduleRelationship
export const TripScheduleRelationshipSchema = z.enum([
  'SCHEDULED',
  'ADDED',
  'UNSCHEDULED',
  'CANCELED',
  'REPLACEMENT',
  'DUPLICATED',
  'DELETED',
]);
export type TripScheduleRelationship = z.infer<typeof TripScheduleRelationshipSchema>;

// Per GTFS-Realtime spec, StopTimeUpdate.ScheduleRelationship
export const StopScheduleRelationshipSchema = z.enum([
  'SCHEDULED',
  'SKIPPED',
  'NO_DATA',
  'UNSCHEDULED',
]);
export type StopScheduleRelationship = z.infer<typeof StopScheduleRelationshipSchema>;

export const StopTimeUpdateSchema = z.object({
  stopSequence: z.number().int().nonnegative(),
  stopId: z.string().min(1),
  scheduleRelationship: StopScheduleRelationshipSchema,
  arrivalTime: z.number().int().optional(),
  arrivalScheduledTime: z.number().int().optional(),
  departureTime: z.number().int().optional(),
  departureScheduledTime: z.number().int().optional(),
});
export type StopTimeUpdate = z.infer<typeof StopTimeUpdateSchema>;

export const TripUpdateSchema = z.object({
  tripId: z.string().min(1),
  routeId: z.string().min(1),
  startTime: z.string().optional(),
  startDate: z.string().optional(),
  directionId: z.number().int().nonnegative().optional(),
  scheduleRelationship: TripScheduleRelationshipSchema,
  vehicleId: z.string().optional(),
  vehicleLabel: z.string().optional(),
  timestamp: z.number().int().optional(),
  stopTimeUpdates: z.array(StopTimeUpdateSchema),
});
export type TripUpdate = z.infer<typeof TripUpdateSchema>;

export const TripUpdatesFeedSchema = z.object({
  feedTimestamp: z.number().int(),
  trips: z.array(TripUpdateSchema),
});
export type TripUpdatesFeed = z.infer<typeof TripUpdatesFeedSchema>;

// ---------------- Vehicle Positions ----------------

// Per GTFS-Realtime spec, VehiclePosition.OccupancyStatus
export const OccupancyStatusSchema = z.enum([
  'EMPTY',
  'MANY_SEATS_AVAILABLE',
  'FEW_SEATS_AVAILABLE',
  'STANDING_ROOM_ONLY',
  'CRUSHED_STANDING_ROOM_ONLY',
  'FULL',
  'NOT_ACCEPTING_PASSENGERS',
  'NO_DATA_AVAILABLE',
  'NOT_BOARDABLE',
]);
export type OccupancyStatus = z.infer<typeof OccupancyStatusSchema>;

export const VehiclePositionSchema = z.object({
  vehicleId: z.string().min(1),
  vehicleLabel: z.string().optional(),
  tripId: z.string().min(1),
  routeId: z.string().min(1),
  startDate: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  bearing: z.number().optional(),
  speed: z.number().optional(),
  timestamp: z.number().int(),
  occupancyStatus: OccupancyStatusSchema.optional(),
  // MARTA reports values >100 for over-capacity buses ("crush loading"),
  // so we don't enforce an upper bound here.
  occupancyPercentage: z.number().int().nonnegative().optional(),
});
export type VehiclePosition = z.infer<typeof VehiclePositionSchema>;

export const VehiclePositionsFeedSchema = z.object({
  feedTimestamp: z.number().int(),
  vehicles: z.array(VehiclePositionSchema),
});
export type VehiclePositionsFeed = z.infer<typeof VehiclePositionsFeedSchema>;

// ---------------- Alerts ----------------

// Per GTFS-Realtime spec, Alert.Cause
export const AlertCauseSchema = z.enum([
  'UNKNOWN_CAUSE',
  'OTHER_CAUSE',
  'TECHNICAL_PROBLEM',
  'STRIKE',
  'DEMONSTRATION',
  'ACCIDENT',
  'HOLIDAY',
  'WEATHER',
  'MAINTENANCE',
  'CONSTRUCTION',
  'POLICE_ACTIVITY',
  'MEDICAL_EMERGENCY',
]);
export type AlertCause = z.infer<typeof AlertCauseSchema>;

// Per GTFS-Realtime spec, Alert.Effect
export const AlertEffectSchema = z.enum([
  'NO_SERVICE',
  'REDUCED_SERVICE',
  'SIGNIFICANT_DELAYS',
  'DETOUR',
  'ADDITIONAL_SERVICE',
  'MODIFIED_SERVICE',
  'OTHER_EFFECT',
  'UNKNOWN_EFFECT',
  'STOP_MOVED',
  'NO_EFFECT',
  'ACCESSIBILITY_ISSUE',
]);
export type AlertEffect = z.infer<typeof AlertEffectSchema>;

export const TimeRangeSchema = z.object({
  start: z.number().int().optional(),
  end: z.number().int().optional(),
});
export type TimeRange = z.infer<typeof TimeRangeSchema>;

export const AlertSchema = z.object({
  id: z.string().min(1),
  cause: AlertCauseSchema.optional(),
  effect: AlertEffectSchema.optional(),
  /** First English translation of header_text, if any. See data-and-apis.md TranslatedString quirk. */
  headerText: z.string().optional(),
  /** First English translation of description_text, if any. */
  descriptionText: z.string().optional(),
  affectedRouteIds: z.array(z.string()),
  affectedStopIds: z.array(z.string()),
  activePeriods: z.array(TimeRangeSchema),
});
export type Alert = z.infer<typeof AlertSchema>;

export const AlertsFeedSchema = z.object({
  feedTimestamp: z.number().int(),
  alerts: z.array(AlertSchema),
});
export type AlertsFeed = z.infer<typeof AlertsFeedSchema>;
