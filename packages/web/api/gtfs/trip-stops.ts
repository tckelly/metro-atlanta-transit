/**
 * Vercel Node Function — serves the ordered stop pattern for a single
 * trip (ADR-0006).
 *
 * Used by the BusRowDisclosure on the stop-detail page to render
 * downstream stops for a specific arrival when no realtime trip update
 * is available (scheduled / no_live_data / cancelled rows). Live rows
 * skip this endpoint entirely and derive downstream stops from the
 * shared realtime feed.
 *
 * Query params:
 *   - tripId  (required) GTFS trip_id
 *
 * Response shape: `{ stopId, stopSequence }[]` in stop_sequence order.
 */
import { z } from 'zod';
import type Database from 'better-sqlite3';

import { getGtfsDb } from './_db.js';
import { queryStopsForTrip } from './queries.js';

const ParamsSchema = z.object({
  tripId: z.string().min(1),
});

export async function handleTripStops(
  req: Request,
  db: Database.Database,
): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const url = new URL(req.url);
  const candidate: Record<string, string> = {};
  const tripId = url.searchParams.get('tripId');
  if (tripId !== null) candidate.tripId = tripId;

  const parsed = ParamsSchema.safeParse(candidate);
  if (!parsed.success) {
    return new Response(`Invalid query params: ${parsed.error.issues[0]?.message}`, {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const stops = queryStopsForTrip(db, parsed.data.tripId);

  return new Response(JSON.stringify(stops), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Trip patterns change only on weekly+ static GTFS rebuilds. A
      // 5-minute edge cache + long stale-while-revalidate window
      // collapses repeats without making rebuilds slow to propagate.
      'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
    },
  });
}

export async function GET(req: Request): Promise<Response> {
  return handleTripStops(req, getGtfsDb());
}

export async function HEAD(req: Request): Promise<Response> {
  return handleTripStops(req, getGtfsDb());
}
