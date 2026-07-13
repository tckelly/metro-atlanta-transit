/**
 * Vercel Edge Function — proxies MARTA's rail (RTT) real-time arrivals.
 *
 * Injects `MARTA_RAIL_API_KEY` (a server-only env var) into the upstream
 * request. The key is never read from the client's request nor reflected
 * back to it. Unlike the bus GTFS-RT feeds, this endpoint is JSON and lives
 * on a non-standard port (:18096). See ADR-0010.
 */
import { proxyRailArrivals } from './_railProxy.js';

export const runtime = 'edge';

// Base URL WITHOUT the apiKey — the key is appended server-side in the proxy.
const UPSTREAM =
  'https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/developerservices/traindata';

export async function GET(req: Request): Promise<Response> {
  // Intentionally does not read req's query string: the key comes only from
  // the environment, so a caller cannot supply or override it.
  return proxyRailArrivals({
    baseUrl: UPSTREAM,
    apiKey: process.env.MARTA_RAIL_API_KEY ?? '',
    signal: req.signal,
  });
}
