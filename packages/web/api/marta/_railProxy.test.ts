import { describe, it, expect, vi } from 'vitest';

import { proxyRailArrivals } from './_railProxy.js';

const BASE_URL =
  'https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/developerservices/traindata';
const KEY = 'SECRET-abc-123';

// Doc-derived sample (rail.md Data table). Synthesized for unit tests only —
// the real fixture lands in sample-data/ after Phase-2 recon, and the schema
// tightens against it. See ADR-0010.
const SAMPLE_ARRIVALS = [
  {
    STATION: 'FIVE POINTS STATION',
    LINE: 'RED',
    DIRECTION: 'N',
    DESTINATION: 'North Springs',
    TRAIN_ID: '303509',
    NEXT_ARR: '10:15:30 PM',
    WAITING_TIME: '4 min',
    WAITING_SECONDS: '240',
    IS_REALTIME: 'true',
    EVENT_TIME: '2026-07-13T22:11:30',
  },
];

function upstreamJson(data: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as unknown as typeof globalThis.fetch;
}

/** Captures the URL the proxy fetched, so we can assert on key injection. */
function captureUrl(): { fetch: typeof globalThis.fetch; url: () => string } {
  let calledUrl = '';
  const fetch = vi.fn(async (u: RequestInfo | URL) => {
    calledUrl = String(u);
    return new Response(JSON.stringify(SAMPLE_ARRIVALS), { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, url: () => calledUrl };
}

describe('proxyRailArrivals', () => {
  it('injects the apiKey as a query param on the upstream request', async () => {
    const cap = captureUrl();
    await proxyRailArrivals({ baseUrl: BASE_URL, apiKey: KEY, fetch: cap.fetch });

    expect(new URL(cap.url()).searchParams.get('apiKey')).toBe(KEY);
  });

  it('carries no query param other than the injected apiKey', async () => {
    // The proxy builds the upstream URL from a fixed base — it never copies a
    // client query string, so a caller cannot override or read the key.
    const cap = captureUrl();
    await proxyRailArrivals({ baseUrl: BASE_URL, apiKey: KEY, fetch: cap.fetch });

    expect([...new URL(cap.url()).searchParams.keys()]).toEqual(['apiKey']);
  });

  it('returns 200 application/json with the validated arrivals on success', async () => {
    const res = await proxyRailArrivals({
      baseUrl: BASE_URL,
      apiKey: KEY,
      fetch: upstreamJson(SAMPLE_ARRIVALS),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.json()).toEqual(SAMPLE_ARRIVALS);
  });

  it('sets an edge Cache-Control with s-maxage and stale-while-revalidate', async () => {
    const res = await proxyRailArrivals({
      baseUrl: BASE_URL,
      apiKey: KEY,
      fetch: upstreamJson(SAMPLE_ARRIVALS),
    });
    const cc = res.headers.get('Cache-Control') ?? '';
    expect(cc).toMatch(/s-maxage=\d+/);
    expect(cc).toMatch(/stale-while-revalidate=\d+/);
  });

  it('fails fast with 500 and does not call upstream when the key is empty', async () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch;
    const res = await proxyRailArrivals({ baseUrl: BASE_URL, apiKey: '', fetch });

    expect(res.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only key as unconfigured', async () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch;
    const res = await proxyRailArrivals({ baseUrl: BASE_URL, apiKey: '   ', fetch });

    expect(res.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 502 when upstream responds 4xx (e.g. bad key)', async () => {
    const res = await proxyRailArrivals({
      baseUrl: BASE_URL,
      apiKey: KEY,
      fetch: upstreamJson('Unauthorized', 401),
    });
    expect(res.status).toBe(502);
  });

  it('returns 502 when upstream responds 5xx', async () => {
    const res = await proxyRailArrivals({
      baseUrl: BASE_URL,
      apiKey: KEY,
      fetch: upstreamJson('boom', 503),
    });
    expect(res.status).toBe(502);
  });

  it('returns 502 when the upstream fetch throws', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof globalThis.fetch;
    const res = await proxyRailArrivals({ baseUrl: BASE_URL, apiKey: KEY, fetch });
    expect(res.status).toBe(502);
  });

  it('returns 502 when upstream returns non-JSON', async () => {
    const fetch = vi.fn(
      async () => new Response('<html>not json</html>', { status: 200 }),
    ) as unknown as typeof globalThis.fetch;
    const res = await proxyRailArrivals({ baseUrl: BASE_URL, apiKey: KEY, fetch });
    expect(res.status).toBe(502);
  });

  it('returns 502 when the JSON fails the arrivals schema', async () => {
    const res = await proxyRailArrivals({
      baseUrl: BASE_URL,
      apiKey: KEY,
      fetch: upstreamJson({ not: 'an array' }),
    });
    expect(res.status).toBe(502);
  });

  it('never leaks the apiKey in the success body or headers', async () => {
    const res = await proxyRailArrivals({
      baseUrl: BASE_URL,
      apiKey: KEY,
      fetch: upstreamJson(SAMPLE_ARRIVALS),
    });

    expect(await res.text()).not.toContain(KEY);
    for (const [, value] of res.headers) {
      expect(value).not.toContain(KEY);
    }
  });

  it('never leaks the apiKey in an error body, even when the caught error contains it', async () => {
    // A fetch failure's message/cause can echo the request URL (which carries
    // the key). The proxy must emit a static message, never the caught error.
    const fetch = vi.fn(async () => {
      throw new Error(`request to ${BASE_URL}?apiKey=${KEY} failed`);
    }) as unknown as typeof globalThis.fetch;
    const res = await proxyRailArrivals({ baseUrl: BASE_URL, apiKey: KEY, fetch });

    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(KEY);
  });

  it('passes an AbortSignal through to upstream', async () => {
    let received: AbortSignal | undefined;
    const fetch = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      received = init?.signal ?? undefined;
      return new Response(JSON.stringify(SAMPLE_ARRIVALS), { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const controller = new AbortController();
    await proxyRailArrivals({
      baseUrl: BASE_URL,
      apiKey: KEY,
      fetch,
      signal: controller.signal,
    });

    expect(received).toBe(controller.signal);
  });
});
