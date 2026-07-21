import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchRailArrivals, type RailArrivalDTO } from '../../services/martaRail';
import { railStationsFromArrivals, type RailStation } from './railStations';

export interface UseRailStationsResult {
  status: 'loading' | 'success' | 'error';
  stations: RailStation[];
  error: Error | null;
  refresh: () => Promise<void>;
}

export interface UseRailStationsOptions {
  /** Data source, injected for testing (default: the real proxy service). */
  fetcher?: (signal?: AbortSignal) => Promise<RailArrivalDTO[]>;
}

interface InternalState {
  status: 'loading' | 'success' | 'error';
  stations: RailStation[];
  error: Error | null;
}

const INITIAL_STATE: InternalState = { status: 'loading', stations: [], error: null };

/**
 * One-shot fetch of the rail station directory. Unlike `useRailArrivals`, this
 * does not poll: the set of stations is effectively static, so a single fetch on
 * mount (plus manual `refresh`) is enough. Derives the list from the feed — the
 * authoritative station names — so every `/station/:name` link resolves.
 */
export function useRailStations(options: UseRailStationsOptions = {}): UseRailStationsResult {
  const { fetcher = fetchRailArrivals } = options;
  const [state, setState] = useState<InternalState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const doFetch = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const arrivals = await fetcherRef.current(controller.signal);
      if (controller.signal.aborted) return;
      setState({ status: 'success', stations: railStationsFromArrivals(arrivals), error: null });
    } catch (err) {
      if (controller.signal.aborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ status: 'error', stations: [], error });
    }
  }, []);

  useEffect(() => {
    void doFetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [doFetch]);

  return useMemo(
    () => ({
      status: state.status,
      stations: state.stations,
      error: state.error,
      refresh: doFetch,
    }),
    [state, doFetch],
  );
}
