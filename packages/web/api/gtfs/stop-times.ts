/**
 * Vercel Node Function — serves scheduled stop-visits from the GTFS
 * SQLite (ADR-0006).
 *
 * Query params:
 *   - stopId      (required) GTFS stop_id
 *   - date        (required) GTFS service date, "YYYYMMDD"
 *   - nowSec      (optional) Unix seconds; when present, the response is
 *                            sliced to the next `count` upcoming visits
 *   - count       (optional, default 5) hard cap on result size
 *   - windowSec   (optional) max seconds ahead of `nowSec` to consider
 *
 * Inputs validated with Zod — the proxy fronts public HTTP.
 */
import { z } from 'zod';
import type Database from 'better-sqlite3';

import { getGtfsDb } from './_db';
import { queryScheduledVisits } from './queries';

const ParamsSchema = z.object({
  stopId: z.string().min(1),
  date: z.string().regex(/^\d{8}$/, 'date must be YYYYMMDD'),
  nowSec: z.coerce.number().int().nonnegative().optional(),
  count: z.coerce.number().int().positive().optional(),
  windowSec: z.coerce.number().int().nonnegative().optional(),
});

/**
 * Pure entry point — accepts a DB so tests can drive it with an
 * in-memory database. The default export is the Vercel-facing wrapper.
 */
export async function handleStopTimes(
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
  for (const key of ['stopId', 'date', 'nowSec', 'count', 'windowSec'] as const) {
    const val = url.searchParams.get(key);
    if (val !== null) candidate[key] = val;
  }

  const parsed = ParamsSchema.safeParse(candidate);
  if (!parsed.success) {
    return new Response(`Invalid query params: ${parsed.error.issues[0]?.message}`, {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // exactOptionalPropertyTypes requires we only set keys we actually
  // have — `undefined` doesn't satisfy `?: number`.
  const queryParams: Parameters<typeof queryScheduledVisits>[1] = {
    stopId: parsed.data.stopId,
    date: parsed.data.date,
  };
  if (parsed.data.nowSec !== undefined) queryParams.nowSec = parsed.data.nowSec;
  if (parsed.data.count !== undefined) queryParams.count = parsed.data.count;
  if (parsed.data.windowSec !== undefined) queryParams.windowSec = parsed.data.windowSec;

  const visits = queryScheduledVisits(db, queryParams);

  return new Response(JSON.stringify(visits), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // 60s edge cache — the GTFS data only changes nightly; collapsing
      // requests across the polling cadence is a clear win.
      'Cache-Control': 's-maxage=60, stale-while-revalidate=600',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  return handleStopTimes(req, getGtfsDb());
}
