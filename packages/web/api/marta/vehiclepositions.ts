/**
 * Vercel Edge Function — proxies MARTA's GTFS-RT vehicle positions feed.
 * See ADR-0005.
 */
import { proxyToMarta } from './_proxy.js';

export const runtime = 'edge';

const UPSTREAM =
  'https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb';

export async function GET(req: Request): Promise<Response> {
  return proxyToMarta({ upstreamUrl: UPSTREAM, signal: req.signal });
}

export async function HEAD(req: Request): Promise<Response> {
  return proxyToMarta({ upstreamUrl: UPSTREAM, signal: req.signal });
}
