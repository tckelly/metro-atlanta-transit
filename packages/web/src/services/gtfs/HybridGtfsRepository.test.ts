import { describe, it, expect, vi } from 'vitest';

import { HybridGtfsRepository, type SmallGtfsBundle } from './HybridGtfsRepository';
import type { ScheduledStopVisit } from '../../features/stops/busRowClassifier';

const BUNDLE: SmallGtfsBundle = {
  stops: [
    { stopId: 'S1', name: 'Stop One', lat: 33.7540, lng: -84.3915, routeIds: ['116'] },
    { stopId: 'S2', name: 'Stop Two', lat: 33.7544, lng: -84.3915, routeIds: ['116'] },
    { stopId: 'S3', name: 'Far Away', lat: 34.0, lng: -84.0, routeIds: ['999'] },
  ],
  routes: [
    { routeId: '116', shortName: '116', longName: 'Decatur via Avondale' },
    { routeId: '999', shortName: '999', longName: 'Test' },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fakeFetch(routes: Record<string, Response | (() => Response)>): typeof globalThis.fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    // Match by path (ignore query string for the lookup).
    const path = url.split('?')[0] ?? url;
    const handler = routes[path] ?? routes[url];
    if (handler === undefined) {
      throw new Error(`No fake route for ${url}`);
    }
    const res = typeof handler === 'function' ? handler() : handler;
    return res;
  }) as unknown as typeof globalThis.fetch;
}

describe('HybridGtfsRepository — sync metadata', () => {
  it('getStop reads from the in-memory bundle', () => {
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch: fakeFetch({}) });
    expect(repo.getStop('S1')?.name).toBe('Stop One');
    expect(repo.getStop('nope')).toBeUndefined();
  });

  it('getRoute reads from the in-memory bundle', () => {
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch: fakeFetch({}) });
    expect(repo.getRoute('116')?.longName).toBe('Decatur via Avondale');
    expect(repo.getRoute('nope')).toBeUndefined();
  });

  it('listStops/listRoutes return the bundle contents', () => {
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch: fakeFetch({}) });
    expect(repo.listStops()).toHaveLength(3);
    expect(repo.listRoutes()).toHaveLength(2);
  });
});

describe('HybridGtfsRepository — getScheduledVisitsForStop', () => {
  it('calls the backend with stopId + date and returns the parsed result', async () => {
    const wire: ScheduledStopVisit[] = [
      {
        tripId: 'T1',
        routeId: '116',
        stopId: 'S1',
        scheduledTime: 1767611400,
        headsign: 'Decatur',
      },
    ];
    const fetch = fakeFetch({ '/api/gtfs/stop-times': jsonResponse(wire) });
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch });

    const visits = await repo.getScheduledVisitsForStop({ stopId: 'S1', date: '20260105' });
    expect(visits).toEqual(wire);

    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain('stopId=S1');
    expect(calledUrl).toContain('date=20260105');
  });

  it('passes optional window params (nowSec, count, windowSec)', async () => {
    const fetch = fakeFetch({ '/api/gtfs/stop-times': jsonResponse([]) });
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch });

    await repo.getScheduledVisitsForStop({
      stopId: 'S1',
      date: '20260105',
      nowSec: 1700000000,
      count: 3,
      windowSec: 1800,
    });

    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain('nowSec=1700000000');
    expect(calledUrl).toContain('count=3');
    expect(calledUrl).toContain('windowSec=1800');
  });

  it('throws when the backend returns a non-2xx status', async () => {
    const fetch = fakeFetch({
      '/api/gtfs/stop-times': new Response('boom', { status: 502 }),
    });
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch });

    await expect(
      repo.getScheduledVisitsForStop({ stopId: 'S1', date: '20260105' }),
    ).rejects.toThrow(/502/);
  });

  it('rejects a response whose shape doesn’t match the schema', async () => {
    // CLAUDE.md mandates Zod validation on external data. Even though
    // the backend is "ours," its response is untrusted by the client.
    const fetch = fakeFetch({
      '/api/gtfs/stop-times': jsonResponse([{ tripId: 'T1' /* missing fields */ }]),
    });
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch });

    await expect(
      repo.getScheduledVisitsForStop({ stopId: 'S1', date: '20260105' }),
    ).rejects.toThrow();
  });
});

describe('HybridGtfsRepository — getRouteDirections', () => {
  it('enriches the backend stopId-only response with stop metadata from the bundle', async () => {
    const wire = [
      { headsign: 'Decatur', stopIds: ['S1', 'S2'] },
      { headsign: 'Avondale', stopIds: ['S2', 'S1'] },
    ];
    const fetch = fakeFetch({ '/api/gtfs/route-directions': jsonResponse(wire) });
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch });

    const directions = await repo.getRouteDirections('116');
    expect(directions).toHaveLength(2);
    expect(directions[0]?.headsign).toBe('Decatur');
    expect(directions[0]?.stops.map((s) => s.stopId)).toEqual(['S1', 'S2']);
    expect(directions[0]?.stops[0]?.name).toBe('Stop One');
  });

  it('drops stops that aren’t in the small bundle (unknown stopIds are filtered)', async () => {
    const wire = [{ headsign: 'Decatur', stopIds: ['S1', 'unknown-stop', 'S2'] }];
    const fetch = fakeFetch({ '/api/gtfs/route-directions': jsonResponse(wire) });
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch });

    const directions = await repo.getRouteDirections('116');
    expect(directions[0]?.stops.map((s) => s.stopId)).toEqual(['S1', 'S2']);
  });

  it('throws on non-2xx backend response', async () => {
    const fetch = fakeFetch({
      '/api/gtfs/route-directions': new Response('', { status: 500 }),
    });
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch });
    await expect(repo.getRouteDirections('116')).rejects.toThrow(/500/);
  });

  it('rejects a response whose shape doesn’t match the schema', async () => {
    const fetch = fakeFetch({
      '/api/gtfs/route-directions': jsonResponse([{ headsign: 'Decatur' /* no stopIds */ }]),
    });
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch });
    await expect(repo.getRouteDirections('116')).rejects.toThrow();
  });
});

describe('HybridGtfsRepository — findNearbyStops', () => {
  it('ranks the small bundle’s stops by distance (no backend call)', async () => {
    // The fakeFetch will throw if called — proving this query is local.
    const repo = new HybridGtfsRepository({
      bundle: BUNDLE,
      fetch: vi.fn(() => {
        throw new Error('findNearbyStops should not hit the backend');
      }) as unknown as typeof globalThis.fetch,
    });

    const nearby = await repo.findNearbyStops({ lat: 33.7540, lng: -84.3915 }, 2);
    expect(nearby).toHaveLength(2);
    expect(nearby[0]?.stopId).toBe('S1');
    expect(nearby[1]?.stopId).toBe('S2');
    expect(nearby[0]?.distanceMeters).toBeLessThan(nearby[1]?.distanceMeters ?? Infinity);
  });

  it('returns empty for count <= 0', async () => {
    const repo = new HybridGtfsRepository({ bundle: BUNDLE, fetch: fakeFetch({}) });
    expect(await repo.findNearbyStops({ lat: 0, lng: 0 }, 0)).toEqual([]);
  });
});

describe('HybridGtfsRepository — baseUrl', () => {
  it('honors a configured baseUrl (for testing against staging deploys, etc.)', async () => {
    const fetch = fakeFetch({
      'https://staging.example/api/gtfs/stop-times': jsonResponse([]),
    });
    const repo = new HybridGtfsRepository({
      bundle: BUNDLE,
      fetch,
      baseUrl: 'https://staging.example',
    });
    await repo.getScheduledVisitsForStop({ stopId: 'S1', date: '20260105' });
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl.startsWith('https://staging.example/api/gtfs/stop-times')).toBe(true);
  });
});
