import { z } from 'zod';

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
