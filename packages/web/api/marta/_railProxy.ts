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
 * PROVISIONAL schema — doc-derived (rail.md Data table), not yet verified
 * against a live payload. Deliberately lenient: at this stage its job is to
 * confirm the response is arrival-shaped JSON without rejecting the real
 * payload we're about to capture, so it anchors on the two fields we're
 * confident exist (`STATION`, `LINE`) and passes the rest through untyped.
 * Tighten field types and the `LINE` / `IS_REALTIME` / `DELAY` semantics
 * against the Phase-2 snapshot (`sample-data/marta-rail-*`). See ADR-0010.
 */
const railArrivalSchema = z
  .object({
    STATION: z.string(),
    LINE: z.string(),
  })
  .passthrough();

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

  const parsed = railArrivalsSchema.safeParse(raw);
  if (!parsed.success) {
    return plainError(502, 'Rail upstream returned an unexpected shape.');
  }

  // Re-serialize from validated data so only known-shaped fields are emitted
  // and no upstream header (or the key) can ride along.
  return new Response(JSON.stringify(parsed.data), {
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
