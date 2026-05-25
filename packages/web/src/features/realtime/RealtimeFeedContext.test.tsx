import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ReactNode } from 'react';

import { RealtimeFeedProvider, useRealtimeFeed } from './RealtimeFeedContext';

const here = dirname(fileURLToPath(import.meta.url));
const tuBytes = new Uint8Array(
  readFileSync(join(here, '../../../../../sample-data/marta-gtfs-rt-2026-05-22/tu.pb')),
);

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

function tripUpdateCalls(fn: ReturnType<typeof vi.fn>): number {
  return fn.mock.calls.filter(
    ([url]) => typeof url === 'string' && url.includes('tripupdates'),
  ).length;
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return <RealtimeFeedProvider>{children}</RealtimeFeedProvider>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(1779444000 * 1000));
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('RealtimeFeedProvider', () => {
  it('starts in loading and transitions to success with parsed feeds', async () => {
    mockFetchWith(tuBytes);
    const { result } = renderHook(() => useRealtimeFeed(), { wrapper });

    expect(result.current.status).toBe('loading');
    expect(result.current.tripUpdates).toEqual([]);
    expect(result.current.lastUpdated).toBeNull();

    await flushPromises();

    expect(result.current.status).toBe('success');
    expect(result.current.tripUpdates.length).toBeGreaterThan(0);
    expect(result.current.lastUpdated).not.toBeNull();
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('polls every 60 seconds while the tab is visible', async () => {
    const fetchMock = mockFetchWith(tuBytes);
    renderHook(() => useRealtimeFeed(), { wrapper });

    await flushPromises();
    expect(tripUpdateCalls(fetchMock)).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(tripUpdateCalls(fetchMock)).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(tripUpdateCalls(fetchMock)).toBe(3);
  });

  it('pauses polling while the tab is hidden and resumes on visibility', async () => {
    const fetchMock = mockFetchWith(tuBytes);
    renderHook(() => useRealtimeFeed(), { wrapper });

    await flushPromises();
    expect(tripUpdateCalls(fetchMock)).toBe(1);

    await act(async () => {
      setVisibility('hidden');
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(tripUpdateCalls(fetchMock)).toBe(1);

    await act(async () => {
      setVisibility('visible');
    });
    await flushPromises();
    expect(tripUpdateCalls(fetchMock)).toBe(2);
  });

  it('marks the feed as stale (not error) when a refresh fails after success', async () => {
    const ok = vi.fn(async () => bytesToFreshResponse(tuBytes));
    vi.stubGlobal('fetch', ok);

    const { result } = renderHook(() => useRealtimeFeed(), { wrapper });

    await flushPromises();
    expect(result.current.status).toBe('success');

    ok.mockImplementationOnce(async () => new Response('', { status: 503 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flushPromises();

    expect(result.current.status).toBe('success');
    expect(result.current.isStale).toBe(true);
    expect(result.current.tripUpdates.length).toBeGreaterThan(0);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('surfaces error status when the initial fetch fails (no prior data)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));

    const { result } = renderHook(() => useRealtimeFeed(), { wrapper });
    await flushPromises();

    expect(result.current.status).toBe('error');
    expect(result.current.tripUpdates).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('keeps tripUpdates flowing when only vehiclePositions fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('vehiclepositions')) {
          return new Response('', { status: 503 });
        }
        return bytesToFreshResponse(tuBytes);
      }),
    );

    const { result } = renderHook(() => useRealtimeFeed(), { wrapper });
    await flushPromises();

    expect(result.current.status).toBe('success');
    expect(result.current.isStale).toBe(false);
    expect(result.current.tripUpdates.length).toBeGreaterThan(0);
    expect(result.current.vehiclePositions).toEqual([]);
  });

  it('refresh() triggers an immediate fetch outside the polling cadence', async () => {
    const fetchMock = mockFetchWith(tuBytes);
    const { result } = renderHook(() => useRealtimeFeed(), { wrapper });

    await flushPromises();
    expect(tripUpdateCalls(fetchMock)).toBe(1);

    await act(async () => {
      void result.current.refresh();
    });
    await flushPromises();
    expect(tripUpdateCalls(fetchMock)).toBe(2);
  });

  it('aborts the in-flight request when the provider unmounts', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      }),
    );

    const { unmount } = renderHook(() => useRealtimeFeed(), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('throws when useRealtimeFeed is called outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useRealtimeFeed())).toThrow(/RealtimeFeedProvider/);
    spy.mockRestore();
  });

  it('fans out one upstream fetch cycle across multiple consumers', async () => {
    // The whole point of the shared cache: 5 useRealtimeFeed callers
    // produce ONE polling cycle (one tripUpdates + one vehiclePositions
    // call), not 5. We render 5 sibling consumers inside one provider.
    const fetchMock = mockFetchWith(tuBytes);

    function Consumer() {
      useRealtimeFeed();
      return null;
    }

    function FiveConsumers() {
      return (
        <>
          <Consumer />
          <Consumer />
          <Consumer />
          <Consumer />
          <Consumer />
        </>
      );
    }

    renderHook(() => null, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <RealtimeFeedProvider>
          <FiveConsumers />
          {children}
        </RealtimeFeedProvider>
      ),
    });

    await flushPromises();
    expect(tripUpdateCalls(fetchMock)).toBe(1);
  });
});
