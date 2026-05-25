import {
  decodeTripUpdates,
  decodeVehiclePositions,
  decodeAlerts,
  type TripUpdatesFeed,
  type VehiclePositionsFeed,
  type AlertsFeed,
} from '@atl-transit/gtfs';

/**
 * Realtime endpoints. The client always hits `/api/marta/*` — in dev
 * the Vite proxy (`vite.config.ts`) rewrites that to MARTA's server,
 * and in prod Vercel Edge Functions (`api/marta/*.ts`) do the same.
 * MARTA doesn't send `Access-Control-Allow-Origin`, so browser-direct
 * fetches are not viable. See ADR-0005 and docs/data-and-apis.md.
 */
const MARTA_URLS = {
  tripUpdates: '/api/marta/tripupdates',
  vehiclePositions: '/api/marta/vehiclepositions',
  alerts: '/api/marta/alerts',
} as const;

/**
 * Fetch a binary protobuf payload from MARTA. Throws on non-2xx HTTP status.
 * Network errors and aborts propagate from `fetch`.
 *
 * The caller wires up the timeout via the `AbortSignal` (e.g.,
 * `AbortSignal.timeout(5000)` in the polling hook), so the service stays
 * deterministic and easy to test.
 */
async function fetchBinary(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const init: RequestInit = signal ? { signal } : {};
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`MARTA fetch failed: ${res.status} ${res.statusText} (${url})`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export async function fetchTripUpdates(signal?: AbortSignal): Promise<TripUpdatesFeed> {
  const bytes = await fetchBinary(MARTA_URLS.tripUpdates, signal);
  return decodeTripUpdates(bytes);
}

export async function fetchVehiclePositions(signal?: AbortSignal): Promise<VehiclePositionsFeed> {
  const bytes = await fetchBinary(MARTA_URLS.vehiclePositions, signal);
  return decodeVehiclePositions(bytes);
}

export async function fetchAlerts(signal?: AbortSignal): Promise<AlertsFeed> {
  const bytes = await fetchBinary(MARTA_URLS.alerts, signal);
  return decodeAlerts(bytes);
}
