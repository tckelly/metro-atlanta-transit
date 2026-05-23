import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { useArrivals } from './useArrivals';
import type { GtfsBundle } from '../../buildtime/preprocessGtfs';

const here = dirname(fileURLToPath(import.meta.url));
const tuBytes = new Uint8Array(
  readFileSync(join(here, '../../../../../sample-data/marta-gtfs-rt-2026-05-22/tu.pb')),
);

// Bundle with one scheduled visit at 06:00 EDT on 2026-05-22 for stop 134013,
// matching trip 10802068 from the realtime fixture (which has a live
// prediction for that stop).
const BUNDLE: GtfsBundle = {
  stops: [{ stopId: '134013', name: 'Test Stop', lat: 0, lng: 0, routeIds: ['116'] }],
  routes: [{ routeId: '116', shortName: '116', longName: 'Test' }],
  trips: [{ tripId: '10802068', routeId: '116', serviceId: 'WEEKDAY', headsign: 'Decatur' }],
  stopTimes: [
    {
      tripId: '10802068',
      stopId: '134013',
      stopSequence: 53,
      arrivalTime: '06:01:56',
      departureTime: '06:01:56',
    },
  ],
  calendar: {
    rules: [
      {
        serviceId: 'WEEKDAY',
        weekdays: [true, true, true, true, true, false, false],
        startDate: '20260101',
        endDate: '20261231',
      },
    ],
    exceptions: [],
  },
};

function bytesToFreshResponse(bytes: Uint8Array): Response {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Response(ab);
}

function mockFetchWith(bytes: Uint8Array): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => bytesToFreshResponse(bytes));
  vi.stubGlobal('fetch', fn);
  return fn;
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/**
 * Flush pending microtasks without advancing the fake clock. This lets the
 * initial fetch's promise chain (fetch → arrayBuffer → decode → setState)
 * resolve without accidentally firing the scheduled 30s poll timer.
 */
async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useArrivals', () => {
  it('starts in loading state and transitions to success with classified rows', async () => {
    mockFetchWith(tuBytes);
    const { result } = renderHook(() =>
      useArrivals('134013', BUNDLE, { date: '20260522' }),
    );

    expect(result.current.status).toBe('loading');
    expect(result.current.rows).toEqual([]);
    expect(result.current.lastUpdated).toBeNull();

    await flushPromises();

    expect(result.current.status).toBe('success');
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.status).toBe('live');
    expect(result.current.rows[0]?.predictedTime).toBe(1779467993);
    expect(result.current.lastUpdated).not.toBeNull();
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('polls every 30 seconds while visible', async () => {
    const fetchMock = mockFetchWith(tuBytes);
    renderHook(() => useArrivals('134013', BUNDLE, { date: '20260522' }));

    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('pauses polling while the tab is hidden and resumes on visibility', async () => {
    const fetchMock = mockFetchWith(tuBytes);
    renderHook(() => useArrivals('134013', BUNDLE, { date: '20260522' }));

    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Hide the tab — the scheduled poll should be cancelled
    await act(async () => {
      setVisibility('hidden');
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Return to the tab — should fetch immediately
    await act(async () => {
      setVisibility('visible');
    });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('marks data as stale (not error) when refresh fails after a prior success', async () => {
    const ok = vi.fn(async () => bytesToFreshResponse(tuBytes));
    vi.stubGlobal('fetch', ok);

    const { result } = renderHook(() =>
      useArrivals('134013', BUNDLE, { date: '20260522' }),
    );

    await flushPromises();
    expect(result.current.status).toBe('success');

    // Next call fails
    ok.mockImplementationOnce(async () => new Response('', { status: 503 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await flushPromises();

    expect(result.current.status).toBe('success'); // not 'error' — keep prior data
    expect(result.current.isStale).toBe(true);
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('surfaces error status when the initial fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );

    const { result } = renderHook(() =>
      useArrivals('134013', BUNDLE, { date: '20260522' }),
    );

    await flushPromises();

    expect(result.current.status).toBe('error');
    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('aborts the in-flight request when the component unmounts', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => {}); // hang forever
      }),
    );

    const { unmount } = renderHook(() =>
      useArrivals('134013', BUNDLE, { date: '20260522' }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('manual refresh triggers an immediate fetch outside the polling cadence', async () => {
    const fetchMock = mockFetchWith(tuBytes);
    const { result } = renderHook(() =>
      useArrivals('134013', BUNDLE, { date: '20260522' }),
    );

    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refresh();
    });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
