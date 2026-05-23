import {
  decodeTripUpdates,
  decodeVehiclePositions,
  decodeAlerts,
  type TripUpdatesFeed,
  type VehiclePositionsFeed,
  type AlertsFeed,
} from '@atl-transit/gtfs';

/**
 * MARTA GTFS-Realtime endpoint URLs. Public, no auth required.
 *
 * In dev, we use a relative path that Vite proxies to MARTA's server
 * (see vite.config.ts) — necessary because MARTA doesn't send
 * Access-Control-Allow-Origin headers and browser-direct fetches fail
 * CORS. Production will need a backend proxy; see docs/architecture.md.
 *
 * See docs/data-and-apis.md.
 */
const MARTA_BASE = import.meta.env.DEV
  ? '/api/marta'
  : 'https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService';

const MARTA_URLS = {
  tripUpdates: `${MARTA_BASE}/tripupdate/tripupdates.pb`,
  vehiclePositions: `${MARTA_BASE}/vehicle/vehiclepositions.pb`,
  alerts: `${MARTA_BASE}/alert/alerts.pb`,
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
