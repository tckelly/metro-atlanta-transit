import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useRailStations } from './useRailStations';
import type { RailArrivalDTO } from '../../services/martaRail';

function arrival(overrides: Partial<RailArrivalDTO> = {}): RailArrivalDTO {
  return {
    station: 'FIVE POINTS STATION',
    line: 'RED',
    direction: 'N',
    destination: 'North Springs',
    trainId: 'T',
    arrivalTime: 0,
    isRealtime: true,
    ...overrides,
  };
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}

describe('useRailStations', () => {
  it('starts loading and resolves to the derived station list', async () => {
    const fetcher = vi.fn(async () => [
      arrival({ station: 'FIVE POINTS STATION' }),
      arrival({ station: 'AIRPORT STATION' }),
    ]);
    const { result } = renderHook(() => useRailStations({ fetcher }));

    expect(result.current.status).toBe('loading');
    await flushPromises();

    expect(result.current.status).toBe('success');
    expect(result.current.stations.map((s) => s.name)).toEqual([
      'AIRPORT STATION',
      'FIVE POINTS STATION',
    ]);
  });

  it('surfaces error status when the fetch fails', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('down');
    });
    const { result } = renderHook(() => useRailStations({ fetcher }));
    await flushPromises();

    expect(result.current.status).toBe('error');
    expect(result.current.stations).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('refresh() re-fetches', async () => {
    const fetcher = vi.fn(async () => [arrival()]);
    const { result } = renderHook(() => useRailStations({ fetcher }));
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      void result.current.refresh();
    });
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('aborts the in-flight request on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetcher = vi.fn((signal?: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<RailArrivalDTO[]>(() => {
        /* never resolves */
      });
    });
    const { unmount } = renderHook(() => useRailStations({ fetcher }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });
});
