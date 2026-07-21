/**
 * Client service for MARTA real-time rail (RTT) arrivals.
 *
 * The browser always hits `/api/marta/rail` — the secret-injecting proxy
 * (`api/marta/rail.ts`, ADR-0010) holds the API key and returns validated
 * JSON. This module re-validates that JSON (defense-in-depth: proxy output is
 * still external data to the client, per CLAUDE.md) and normalizes it into a
 * trimmed, parsed DTO for the UI.
 *
 * Timing values come straight from MARTA and are treated as authoritative —
 * we do not recompute delay or ETA from a static rail schedule (ADR-0011).
 * The relative `WAITING_SECONDS` is re-anchored to an absolute arrival time
 * against the feed's `EVENT_TIME`, so the countdown stays honest through the
 * edge-cache window and reuses the bus ETA formatter.
 */
import { z } from 'zod';

import { gtfsTimeToUnixSec } from './gtfsStatic.js';

/**
 * One normalized rail arrival prediction at a station. Domain values (`line`,
 * `direction`) map to visual tokens at the web boundary (ADR-0003), not here.
 * Field selection and rationale live in `docs/features/rail.md`.
 */
export interface RailArrivalDTO {
  station: string;
  /** `RED` | `GOLD` | `BLUE` | `GREEN` in practice; kept a plain string so an unknown line degrades one row. */
  line: string;
  /** Cardinal platform direction: `N` | `S` | `E` | `W`. */
  direction: string;
  /** Terminus headsign, e.g. "North Springs". */
  destination: string;
  /** Stable identifier for a train across polls. */
  trainId: string;
  /** Absolute predicted arrival, Unix seconds. Derived from `EVENT_TIME + WAITING_SECONDS` (ADR-0011). */
  arrivalTime: number;
  /** Real-time prediction vs. scheduled. Drives the live/scheduled status classification. */
  isRealtime: boolean;
  /** MARTA's schedule deviation in seconds (+late / −early). Real-time records only. */
  delaySeconds?: number;
  /** Train latitude. Real-time records only; retained for a future map view. */
  latitude?: number;
  /** Train longitude. Real-time records only. */
  longitude?: number;
}

const RAIL_URL = '/api/marta/rail';

/**
 * The subset of the proxy's rail record the client consumes. Narrower than the
 * proxy's own drift-guard schema by design (ADR-0010 "Revisit when"): only the
 * fields the UI needs are required, so records that fail this validation are
 * ones we genuinely cannot render. Unknown keys (`NEXT_ARR`, `WAITING_TIME`)
 * are stripped — we re-derive ETA ourselves for a single presentation path.
 */
const railRecordSchema = z.object({
  STATION: z.string(),
  LINE: z.string(),
  DIRECTION: z.string(),
  DESTINATION: z.string(),
  TRAIN_ID: z.string(),
  WAITING_SECONDS: z.string(),
  IS_REALTIME: z.string(),
  EVENT_TIME: z.string(),
  DELAY: z.string().optional(),
  LATITUDE: z.string().optional(),
  LONGITUDE: z.string().optional(),
});

type RailRecord = z.infer<typeof railRecordSchema>;

/** `MM/DD/YYYY h:mm:ss AM/PM` — MARTA's feed timestamp format (US, 12-hour). */
const EVENT_TIME_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/;

/** `T<seconds>S` signed duration, e.g. `T45S`, `T-7S`, `T0S`. */
const DELAY_RE = /^T(-?\d+)S$/;

/**
 * Convert MARTA's `EVENT_TIME` to Unix seconds in Atlanta local time. Reuses
 * `gtfsTimeToUnixSec` for the (DST-aware) wall-clock→Unix conversion. Returns
 * `undefined` on any parse failure so the caller can fall back gracefully.
 */
function parseEventTime(eventTime: string): number | undefined {
  const m = EVENT_TIME_RE.exec(eventTime.trim());
  if (!m) return undefined;

  const [, month, day, year, hh, mm, ss, meridiem] = m as unknown as [
    string, string, string, string, string, string, string, 'AM' | 'PM',
  ];

  const hour12 = Number(hh);
  const hour24 = meridiem === 'AM' ? hour12 % 12 : (hour12 % 12) + 12;

  const serviceDate = `${year}${month}${day}`;
  const gtfsTime = `${String(hour24).padStart(2, '0')}:${mm}:${ss}`;
  try {
    return gtfsTimeToUnixSec(serviceDate, gtfsTime);
  } catch {
    return undefined;
  }
}

/** Parse `T<sec>S` → signed seconds, or `undefined` if it doesn't match. */
function parseDelaySeconds(delay: string): number | undefined {
  const m = DELAY_RE.exec(delay);
  return m ? Number(m[1]) : undefined;
}

/** `Number(s)` but `undefined` (not `NaN`) when it isn't finite. */
function toFiniteNumber(value: string): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Normalize a validated record to a DTO, or `undefined` if it has no usable
 * ETA. `nowSec` is the fallback anchor when `EVENT_TIME` is unparseable; it's
 * passed in (not read from the clock) so this stays pure and testable.
 */
function toDTO(record: RailRecord, nowSec: number): RailArrivalDTO | undefined {
  const waitingSeconds = Number(record.WAITING_SECONDS);
  if (!Number.isFinite(waitingSeconds)) return undefined;

  const anchor = parseEventTime(record.EVENT_TIME) ?? nowSec;
  const delaySeconds = record.DELAY !== undefined ? parseDelaySeconds(record.DELAY) : undefined;
  const latitude = record.LATITUDE !== undefined ? toFiniteNumber(record.LATITUDE) : undefined;
  const longitude = record.LONGITUDE !== undefined ? toFiniteNumber(record.LONGITUDE) : undefined;

  return {
    station: record.STATION,
    line: record.LINE,
    direction: record.DIRECTION,
    destination: record.DESTINATION,
    trainId: record.TRAIN_ID,
    arrivalTime: anchor + waitingSeconds,
    isRealtime: record.IS_REALTIME === 'true',
    ...(delaySeconds !== undefined ? { delaySeconds } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
  };
}

/**
 * Validate and normalize a raw rail-proxy payload into DTOs. Malformed records
 * are dropped rather than failing the whole feed (graceful degradation,
 * mirroring the proxy) — one bad record must never blank the rail view.
 *
 * @param raw   The parsed proxy response (expected: an array of records).
 * @param nowSec Current Unix seconds — the fallback anchor for arrival times.
 */
export function normalizeRailArrivals(raw: unknown, nowSec: number): RailArrivalDTO[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = railRecordSchema.safeParse(item);
    if (!parsed.success) return [];
    const dto = toDTO(parsed.data, nowSec);
    return dto ? [dto] : [];
  });
}

/**
 * Fetch and normalize real-time rail arrivals from the proxy.
 *
 * @param signal Optional abort signal; the caller wires up any timeout.
 * @returns Normalized arrivals; an empty array if the payload has no usable records.
 * @throws If the proxy responds with a non-2xx status.
 */
export async function fetchRailArrivals(signal?: AbortSignal): Promise<RailArrivalDTO[]> {
  const init: RequestInit = signal ? { signal } : {};
  const res = await fetch(RAIL_URL, init);
  if (!res.ok) {
    throw new Error(`Rail fetch failed: ${res.status} ${res.statusText} (${RAIL_URL})`);
  }
  const raw: unknown = await res.json();
  return normalizeRailArrivals(raw, Math.floor(Date.now() / 1000));
}
