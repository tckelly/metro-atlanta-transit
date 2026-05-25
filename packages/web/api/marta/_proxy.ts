/**
 * Shared MARTA realtime proxy helper.
 *
 * Hits the configured upstream URL server-side and returns the protobuf
 * body to the client with an edge-cache TTL. Any failure mode collapses
 * to a 502 with a plain-text body so the client gets a clean signal
 * instead of an opaque connection-level error.
 *
 * The `fetch` implementation is dependency-injected — tests pass a fake
 * to exercise success and failure modes without hitting the network.
 *
 * See ADR-0005.
 */

/**
 * Edge cache lifetime. 10 seconds keeps multiple co-located clients
 * collapsing onto one upstream call without staleness becoming visible
 * (the client polls every 60s and MARTA's feed refreshes every ~30s).
 * `stale-while-revalidate=30` smooths cold-cache moments.
 */
const EDGE_CACHE_CONTROL = 's-maxage=10, stale-while-revalidate=30';

const DEFAULT_CONTENT_TYPE = 'application/x-protobuf';

export interface ProxyOptions {
  upstreamUrl: string;
  /** Override the fetch implementation. Defaults to the runtime's `fetch`. */
  fetch?: typeof globalThis.fetch;
  /** Pass through the client's abort signal so a disconnect cancels upstream. */
  signal?: AbortSignal;
}

export async function proxyToMarta({
  upstreamUrl,
  fetch = globalThis.fetch,
  signal,
}: ProxyOptions): Promise<Response> {
  let upstream: Response;
  try {
    const init: RequestInit = signal !== undefined ? { signal } : {};
    upstream = await fetch(upstreamUrl, init);
  } catch (err) {
    return plainError(502, `Upstream unreachable: ${describeError(err)}`);
  }

  if (!upstream.ok) {
    return plainError(502, `Upstream returned ${upstream.status} ${upstream.statusText}`);
  }

  const body = await upstream.arrayBuffer();
  const contentType = upstream.headers.get('Content-Type') ?? DEFAULT_CONTENT_TYPE;

  // Build an explicit allowlist of response headers — we never want
  // Set-Cookie or other surprising upstream headers to leak through.
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
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

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
