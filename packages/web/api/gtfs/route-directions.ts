/**
 * Vercel Node Function — serves canonical headsign-grouped stop
 * sequences for a route (ADR-0006).
 *
 * Query params:
 *   - routeId  (required) GTFS route_id
 *
 * Response shape: `{ headsign, stopIds }[]`. Client enriches stopIds
 * with stop metadata from the small in-memory bundle.
 */
import { z } from 'zod';
import type Database from 'better-sqlite3';

import { getGtfsDb } from './_db.js';
import { queryRouteDirections } from './queries.js';

const ParamsSchema = z.object({
  routeId: z.string().min(1),
});

export async function handleRouteDirections(
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
  const routeId = url.searchParams.get('routeId');
  if (routeId !== null) candidate.routeId = routeId;

  const parsed = ParamsSchema.safeParse(candidate);
  if (!parsed.success) {
    return new Response(`Invalid query params: ${parsed.error.issues[0]?.message}`, {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const directions = queryRouteDirections(db, parsed.data.routeId);

  return new Response(JSON.stringify(directions), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Route structure changes ~weekly. 5-minute edge cache + long
      // stale-while-revalidate is plenty.
      'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  return handleRouteDirections(req, getGtfsDb());
}
