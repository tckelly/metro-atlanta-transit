import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { fetchTripUpdates, fetchVehiclePositions, fetchAlerts } from './martaRealtime';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '../../../../sample-data/marta-gtfs-rt-2026-05-22');
const tuBytes = new Uint8Array(readFileSync(join(fixturesDir, 'tu.pb')));
const vpBytes = new Uint8Array(readFileSync(join(fixturesDir, 'vp.pb')));
const alBytes = new Uint8Array(readFileSync(join(fixturesDir, 'al.pb')));

function mockFetchOnceWith(bytes: Uint8Array, init?: ResponseInit): ReturnType<typeof vi.fn> {
  // Copy into a fresh ArrayBuffer. The DOM lib's BodyInit accepts ArrayBuffer
  // but not the generic Uint8Array<ArrayBufferLike> that TS 5.7+ infers from
  // readFileSync output (which could in theory be SharedArrayBuffer-backed).
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const fn = vi.fn(async () => new Response(ab, init));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTripUpdates', () => {
  it('fetches and decodes a trip_updates feed', async () => {
    const fetchMock = mockFetchOnceWith(tuBytes);
    const feed = await fetchTripUpdates();
    expect(feed.trips.length).toBe(388);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('tripupdate/tripupdates.pb'),
      expect.objectContaining({}),
    );
  });

  it('throws when the server returns a non-2xx status', async () => {
    mockFetchOnceWith(new Uint8Array(), { status: 503, statusText: 'Service Unavailable' });
    await expect(fetchTripUpdates()).rejects.toThrow(/503/);
  });

  it('propagates network errors from fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down');
      }),
    );
    await expect(fetchTripUpdates()).rejects.toThrow('network down');
  });

  it('passes through an AbortSignal to fetch', async () => {
    const fetchMock = mockFetchOnceWith(tuBytes);
    const controller = new AbortController();
    await fetchTripUpdates(controller.signal);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe('fetchVehiclePositions', () => {
  it('fetches and decodes a vehicle_positions feed', async () => {
    const fetchMock = mockFetchOnceWith(vpBytes);
    const feed = await fetchVehiclePositions();
    expect(feed.vehicles.length).toBe(198);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('vehicle/vehiclepositions.pb'),
      expect.objectContaining({}),
    );
  });
});

describe('fetchAlerts', () => {
  it('fetches and decodes an alerts feed', async () => {
    const fetchMock = mockFetchOnceWith(alBytes);
    const feed = await fetchAlerts();
    expect(feed.alerts).toEqual([]);
    expect(feed.feedTimestamp).toBe(1779468884);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('alert/alerts.pb'),
      expect.objectContaining({}),
    );
  });
});
