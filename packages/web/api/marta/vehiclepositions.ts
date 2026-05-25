/**
 * Vercel Edge Function — proxies MARTA's GTFS-RT vehicle positions feed.
 * See ADR-0005.
 */
import { proxyToMarta } from './_proxy';

export const runtime = 'edge';

const UPSTREAM =
  'https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }
  return proxyToMarta({ upstreamUrl: UPSTREAM, signal: req.signal });
}
