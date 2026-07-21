import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useRailArrivals } from './useRailArrivals';
import type { RailArrivalDTO } from '../../services/martaRail';

const STATION = 'FIVE POINTS STATION';

function arrival(overrides: Partial<RailArrivalDTO> = {}): RailArrivalDTO {
  return {
    station: STATION,
    line: 'RED',
    direction: 'N',
    destination: 'North Springs',
    trainId: 'T',
    arrivalTime: 1000,
    isRealtime: true,
    ...overrides,
  };
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

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});

// DI means no global fetch stub, so there is nothing ambient to unstub — only
// fake timers need restoring (no config toggle does this for us).
afterEach(() => {
  vi.useRealTimers();
});

describe('useRailArrivals', () => {
  it('starts in loading and transitions to success', async () => {
    const fetcher = vi.fn(async () => [arrival()]);
    const { result } = renderHook(() => useRailArrivals(STATION, { fetcher, intervalMs: 30_000 }));

    expect(result.current.status).toBe('loading');
    expect(result.current.arrivals).toEqual([]);
    expect(result.current.lastUpdated).toBeNull();

    await flushPromises();

    expect(result.current.status).toBe('success');
    expect(result.current.arrivals).toHaveLength(1);
    expect(result.current.lastUpdated).not.toBeNull();
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns only arrivals for the requested station', async () => {
    const fetcher = vi.fn(async () => [
      arrival({ trainId: 'MINE', station: STATION }),
      arrival({ trainId: 'OTHER', station: 'AIRPORT STATION' }),
    ]);
    const { result } = renderHook(() => useRailArrivals(STATION, { fetcher }));
    await flushPromises();

    expect(result.current.arrivals.map((a) => a.trainId)).toEqual(['MINE']);
  });

  it('sorts arrivals by arrivalTime ascending', async () => {
    const fetcher = vi.fn(async () => [
      arrival({ trainId: 'LATE', arrivalTime: 3000 }),
      arrival({ trainId: 'SOON', arrivalTime: 1000 }),
      arrival({ trainId: 'MID', arrivalTime: 2000 }),
    ]);
    const { result } = renderHook(() => useRailArrivals(STATION, { fetcher }));
    await flushPromises();

    expect(result.current.arrivals.map((a) => a.trainId)).toEqual(['SOON', 'MID', 'LATE']);
  });

  it('polls every intervalMs while the tab is visible', async () => {
    const fetcher = vi.fn(async () => [arrival()]);
    renderHook(() => useRailArrivals(STATION, { fetcher, intervalMs: 30_000 }));

    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('pauses polling while hidden and resumes on visibility', async () => {
    const fetcher = vi.fn(async () => [arrival()]);
    renderHook(() => useRailArrivals(STATION, { fetcher, intervalMs: 30_000 }));

    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility('hidden');
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility('visible');
    });
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('marks stale (not error) when a poll fails after a prior success', async () => {
    const fetcher = vi.fn(async () => [arrival()]);
    const { result } = renderHook(() => useRailArrivals(STATION, { fetcher, intervalMs: 30_000 }));

    await flushPromises();
    expect(result.current.status).toBe('success');

    fetcher.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await flushPromises();

    expect(result.current.status).toBe('success');
    expect(result.current.isStale).toBe(true);
    expect(result.current.arrivals).toHaveLength(1);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('surfaces error status when the initial fetch fails (no prior data)', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('down');
    });
    const { result } = renderHook(() => useRailArrivals(STATION, { fetcher }));
    await flushPromises();

    expect(result.current.status).toBe('error');
    expect(result.current.arrivals).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('refresh() triggers an immediate fetch outside the polling cadence', async () => {
    const fetcher = vi.fn(async () => [arrival()]);
    const { result } = renderHook(() => useRailArrivals(STATION, { fetcher, intervalMs: 30_000 }));

    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      void result.current.refresh();
    });
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('aborts the in-flight request when the hook unmounts', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetcher = vi.fn((signal?: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<RailArrivalDTO[]>(() => {
        /* never resolves */
      });
    });

    const { unmount } = renderHook(() => useRailArrivals(STATION, { fetcher }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });
});
