/**
 * Secret-injecting proxy helper for MARTA's rail (RTT) arrivals endpoint.
 *
 * Unlike the byte-passthrough bus proxy (`_proxy.ts`, ADR-0005), this one
 * holds a secret: MARTA's rail API key, which the upstream requires as a
 * query parameter. The key is injected server-side onto a fixed base URL and
 * MUST NEVER reach the client — not in the response body, not in a header,
 * not in any error message. Because the upstream URL is built from a fixed
 * base and never from the client's request, a caller cannot override or read
 * the key. See ADR-0010.
 *
 * The `fetch` implementation is dependency-injected so tests exercise every
 * path — including the key-leak paths — without a network or a real key.
 */
import { z } from 'zod';

/**
 * Edge cache lifetime. Provisional: reuses the bus proxy's cadence until
 * Phase-2 recon reveals the rail feed's own refresh interval (via
 * `EVENT_TIME`). See ADR-0010 "Revisit when".
 */
const EDGE_CACHE_CONTROL = 's-maxage=10, stale-while-revalidate=30';

/**
 * One predicted rail arrival, tightened against the Phase-2 snapshot
 * (`sample-data/marta-rail-2026-07-13`). Every field is a string in the feed
 * (numbers, booleans, and coordinates are all stringified), so all fields are
 * typed as strings and parsed at the point of use.
 *
 * `LINE` is deliberately kept a plain string, not an enum: it is
 * RED|GOLD|BLUE|GREEN in the feed today, but mapping the value to a color
 * token happens at the web boundary (ADR-0003), so an unexpected line value
 * degrades a single row rather than failing the whole feed.
 *
 * `DELAY`, `LATITUDE`, and `LONGITUDE` are optional: the snapshot shows they
 * appear only when `IS_REALTIME === "true"` — scheduled predictions omit them.
 * Unknown keys are stripped (Zod default), trimming the payload to a known shape.
 */
const railArrivalSchema = z.object({
  STATION: z.string(),
  LINE: z.string(),
  DIRECTION: z.string(),
  DESTINATION: z.string(),
  TRAIN_ID: z.string(),
  NEXT_ARR: z.string(),
  WAITING_TIME: z.string(),
  WAITING_SECONDS: z.string(),
  IS_REALTIME: z.string(),
  EVENT_TIME: z.string(),
  DELAY: z.string().optional(),
  LATITUDE: z.string().optional(),
  LONGITUDE: z.string().optional(),
});

/** A validated rail arrival. Domain values map to visual tokens at the web boundary. */
export type RailArrival = z.infer<typeof railArrivalSchema>;

export const railArrivalsSchema = z.array(railArrivalSchema);

export interface RailProxyOptions {
  /** Upstream endpoint WITHOUT the apiKey param — the key is injected here. */
  baseUrl: string;
  /** MARTA rail API key, read server-side from `process.env`. Never client-visible. */
  apiKey: string;
  /** Override the fetch implementation. Defaults to the runtime's `fetch`. */
  fetch?: typeof globalThis.fetch;
  /** Pass through the client's abort signal so a disconnect cancels upstream. */
  signal?: AbortSignal;
}

export async function proxyRailArrivals({
  baseUrl,
  apiKey,
  fetch = globalThis.fetch,
  signal,
}: RailProxyOptions): Promise<Response> {
  if (apiKey.trim() === '') {
    // Fail fast without calling upstream: a keyless request just 401s and
    // wastes a round-trip. Generic message — never hint at key state beyond this.
    return plainError(500, 'Rail service is not configured.');
  }

  const upstreamUrl = new URL(baseUrl);
  upstreamUrl.searchParams.set('apiKey', apiKey);

  let upstream: Response;
  try {
    const init: RequestInit = signal !== undefined ? { signal } : {};
    upstream = await fetch(upstreamUrl.toString(), init);
  } catch {
    // Deliberately swallow the caught error: its message or `cause` can echo
    // the request URL, which carries the key. Emit a static message only.
    return plainError(502, 'Rail upstream unreachable.');
  }

  if (!upstream.ok) {
    // The numeric status is safe to surface; the URL and body are not.
    return plainError(502, `Rail upstream returned ${upstream.status}.`);
  }

  let raw: unknown;
  try {
    raw = await upstream.json();
  } catch {
    return plainError(502, 'Rail upstream returned malformed JSON.');
  }

  if (!Array.isArray(raw)) {
    return plainError(502, 'Rail upstream returned an unexpected shape.');
  }

  // Validate per record and keep the valid ones. This is a system-wide feed of
  // hundreds of arrivals, so one malformed record shouldn't blank the entire
  // rail view — drop it and serve the rest (graceful degradation).
  const arrivals = raw.flatMap((item) => {
    const record = railArrivalSchema.safeParse(item);
    return record.success ? [record.data] : [];
  });

  // Re-serialize from validated data so only known-shaped fields are emitted
  // and no upstream header (or the key) can ride along.
  return new Response(JSON.stringify(arrivals), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': EDGE_CACHE_CONTROL,
    },
  });
}

function plainError(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
