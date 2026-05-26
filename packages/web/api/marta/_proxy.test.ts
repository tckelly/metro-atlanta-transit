import { describe, it, expect, vi } from 'vitest';

import { proxyToMarta } from './_proxy.js';

function upstreamOk(bytes: Uint8Array, headers: Record<string, string> = {}): typeof globalThis.fetch {
  return vi.fn(async () => {
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    return new Response(ab, { status: 200, headers });
  }) as unknown as typeof globalThis.fetch;
}

const SAMPLE_BYTES = new Uint8Array([0x0a, 0x10, 0x32, 0x0e, 0x0a, 0x0c, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);

describe('proxyToMarta', () => {
  it('returns 200 with the upstream bytes on success', async () => {
    const fetch = upstreamOk(SAMPLE_BYTES, { 'Content-Type': 'application/x-protobuf' });
    const res = await proxyToMarta({ upstreamUrl: 'https://example.test/feed.pb', fetch });

    expect(res.status).toBe(200);
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(SAMPLE_BYTES);
  });

  it('forwards the upstream Content-Type', async () => {
    const fetch = upstreamOk(SAMPLE_BYTES, { 'Content-Type': 'application/x-protobuf' });
    const res = await proxyToMarta({ upstreamUrl: 'https://example.test/feed.pb', fetch });
    expect(res.headers.get('Content-Type')).toBe('application/x-protobuf');
  });

  it('defaults Content-Type to application/x-protobuf when upstream omits it', async () => {
    const fetch = upstreamOk(SAMPLE_BYTES);
    const res = await proxyToMarta({ upstreamUrl: 'https://example.test/feed.pb', fetch });
    expect(res.headers.get('Content-Type')).toBe('application/x-protobuf');
  });

  it('sets a Cache-Control with s-maxage and stale-while-revalidate for the edge', async () => {
    const fetch = upstreamOk(SAMPLE_BYTES);
    const res = await proxyToMarta({ upstreamUrl: 'https://example.test/feed.pb', fetch });
    const cc = res.headers.get('Cache-Control') ?? '';
    expect(cc).toMatch(/s-maxage=\d+/);
    expect(cc).toMatch(/stale-while-revalidate=\d+/);
  });

  it('returns 502 when upstream responds with 5xx', async () => {
    const fetch = vi.fn(async () => new Response('upstream down', { status: 503 })) as unknown as typeof globalThis.fetch;
    const res = await proxyToMarta({ upstreamUrl: 'https://example.test/feed.pb', fetch });
    expect(res.status).toBe(502);
  });

  it('returns 502 when upstream responds with 4xx', async () => {
    const fetch = vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof globalThis.fetch;
    const res = await proxyToMarta({ upstreamUrl: 'https://example.test/feed.pb', fetch });
    expect(res.status).toBe(502);
  });

  it('returns 502 when the upstream fetch throws (network failure)', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof globalThis.fetch;
    const res = await proxyToMarta({ upstreamUrl: 'https://example.test/feed.pb', fetch });
    expect(res.status).toBe(502);
  });

  it('does not forward upstream Set-Cookie headers', async () => {
    // Even though MARTA wouldn't set cookies, defense in depth: a proxy
    // that accidentally relayed cookies could leak surprising state to
    // the client.
    const fetch = upstreamOk(SAMPLE_BYTES, { 'Set-Cookie': 'session=abc' });
    const res = await proxyToMarta({ upstreamUrl: 'https://example.test/feed.pb', fetch });
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('passes through an AbortSignal so a disconnected client cancels upstream', async () => {
    let received: AbortSignal | undefined;
    const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      received = init?.signal ?? undefined;
      return new Response(new Uint8Array(SAMPLE_BYTES).buffer, { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const controller = new AbortController();
    await proxyToMarta({
      upstreamUrl: 'https://example.test/feed.pb',
      fetch,
      signal: controller.signal,
    });

    expect(received).toBe(controller.signal);
  });
});
