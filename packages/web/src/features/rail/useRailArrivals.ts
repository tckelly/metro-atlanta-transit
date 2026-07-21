import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchRailArrivals, type RailArrivalDTO } from '../../services/martaRail';

/**
 * Rail polling cadence. Shorter than the bus feed's 60s: the rail payload is
 * far smaller (~135 KB JSON vs ~1 MB protobuf) and edge-cached, and a train
 * countdown is more time-sensitive, so fresher predictions are cheap here.
 */
const DEFAULT_POLL_INTERVAL_MS = 30_000;

export interface UseRailArrivalsResult {
  status: 'loading' | 'success' | 'error';
  /** Arrivals for the requested station, sorted by `arrivalTime` ascending. */
  arrivals: RailArrivalDTO[];
  /** Unix seconds of the last successful fetch; null until one succeeds. */
  lastUpdated: number | null;
  /** True when the latest refresh failed but prior data is still shown. */
  isStale: boolean;
  error: Error | null;
  /** Force an immediate refresh outside the polling cadence. */
  refresh: () => Promise<void>;
}

export interface UseRailArrivalsOptions {
  /**
   * Data source, injected for testing (default: the real proxy service).
   * Passing the collaborator in keeps the polling logic testable without
   * stubbing globals or the module graph (CLAUDE.md: pass collaborators in).
   */
  fetcher?: (signal?: AbortSignal) => Promise<RailArrivalDTO[]>;
  /** Polling cadence while the tab is visible. */
  intervalMs?: number;
}

interface InternalState {
  status: 'loading' | 'success' | 'error';
  arrivals: RailArrivalDTO[];
  lastUpdated: number | null;
  isStale: boolean;
  error: Error | null;
}

const INITIAL_STATE: InternalState = {
  status: 'loading',
  arrivals: [],
  lastUpdated: null,
  isStale: false,
  error: null,
};

/**
 * Page-scoped polling for real-time rail arrivals at a single station.
 *
 * Unlike the app-wide bus `RealtimeFeedProvider`, this hook polls only while
 * mounted (i.e. while `StationDetail` is on screen), pauses when the tab is
 * hidden, and aborts in-flight requests on unmount. Rail's first cut has a
 * single consumer, so it needs no cross-consumer multiplexing — see the polling
 * decision in `docs/features/rail.md`. The returned shape mirrors the bus
 * `useArrivals` contract so the page is written against the shape, not the
 * mechanism; a shared polling engine can replace the internals later.
 */
export function useRailArrivals(
  stationName: string,
  options: UseRailArrivalsOptions = {},
): UseRailArrivalsResult {
  const { fetcher = fetchRailArrivals, intervalMs = DEFAULT_POLL_INTERVAL_MS } = options;
  const [state, setState] = useState<InternalState>(INITIAL_STATE);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hold the latest fetcher in a ref so an inline (per-render) fetcher doesn't
  // tear down the polling effect on every render. `stationName`, by contrast,
  // is a real input: it belongs in `doFetch`'s deps so a station change
  // restarts polling and refetches.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const doFetch = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const all = await fetcherRef.current(controller.signal);
      if (controller.signal.aborted) return;
      const arrivals = all
        .filter((a) => a.station === stationName)
        .sort((a, b) => a.arrivalTime - b.arrivalTime);
      setState({
        status: 'success',
        arrivals,
        lastUpdated: Math.floor(Date.now() / 1000),
        isStale: false,
        error: null,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      setState((prev) =>
        prev.status === 'success'
          ? { ...prev, isStale: true, error }
          : { status: 'error', arrivals: [], lastUpdated: null, isStale: false, error },
      );
    }
  }, [stationName]);

  useEffect(() => {
    // Mutable object (not a `let`) so the post-await guards below read a live
    // value TypeScript can't narrow to a constant — no false "unnecessary
    // condition" from the linter.
    const lifecycle = { unmounted: false };

    const clearTimer = (): void => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    // A function call, not an inline condition: each check is then a fresh
    // runtime read. The post-await re-check is genuinely meaningful — the tab
    // can hide or the effect can tear down *during* the await — but as an
    // inline expression the compiler folds it into the pre-await narrowing
    // (`visibilityState` is typed readonly) and flags it as redundant.
    const stopped = (): boolean =>
      lifecycle.unmounted || document.visibilityState !== 'visible';

    const schedule = (): void => {
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        void (async () => {
          if (stopped()) return;
          await doFetch();
          if (stopped()) return;
          schedule();
        })();
      }, intervalMs);
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void doFetch();
        schedule();
      } else {
        clearTimer();
      }
    };

    void doFetch();
    schedule();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      lifecycle.unmounted = true;
      clearTimer();
      abortRef.current?.abort();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [doFetch, intervalMs]);

  return useMemo(
    () => ({
      status: state.status,
      arrivals: state.arrivals,
      lastUpdated: state.lastUpdated,
      isStale: state.isStale,
      error: state.error,
      refresh: doFetch,
    }),
    [state, doFetch],
  );
}
