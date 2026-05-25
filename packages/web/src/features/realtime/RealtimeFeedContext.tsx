/**
 * Shared realtime feed — the single source of truth for MARTA's GTFS-RT
 * data inside the app.
 *
 * One polling loop, not N. Every consumer (StopDetail's `useArrivals`,
 * each FavoriteStopCard on Home, route disruption assessments) reads
 * from the same snapshot, so adding a card to Home does not multiply
 * upstream traffic. The backend's edge cache already collapses repeats
 * across browsers; this collapses repeats within a single tab.
 *
 * Polling lifecycle is identical to the previous per-stop useArrivals:
 * 60s cadence while visible, paused while hidden, aborted on unmount,
 * primary tripUpdates failure → error, vehiclePositions failure →
 * graceful drop (occupancy is secondary signal per data-and-apis.md).
 */
import type { TripUpdate, VehiclePosition } from '@atl-transit/gtfs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { fetchTripUpdates, fetchVehiclePositions } from '../../services/martaRealtime';

const POLL_INTERVAL_MS = 60_000;

export interface RealtimeFeedSnapshot {
  status: 'loading' | 'success' | 'error';
  tripUpdates: TripUpdate[];
  vehiclePositions: VehiclePosition[];
  /** Unix seconds of the last successful fetch; null if never succeeded. */
  lastUpdated: number | null;
  /** True when the most recent refresh failed but prior data is still shown. */
  isStale: boolean;
  error: Error | null;
  /** Force an immediate refresh outside the polling cadence. */
  refresh: () => Promise<void>;
}

interface InternalState {
  status: 'loading' | 'success' | 'error';
  tripUpdates: TripUpdate[];
  vehiclePositions: VehiclePosition[];
  lastUpdated: number | null;
  isStale: boolean;
  error: Error | null;
}

const INITIAL_STATE: InternalState = {
  status: 'loading',
  tripUpdates: [],
  vehiclePositions: [],
  lastUpdated: null,
  isStale: false,
  error: null,
};

/**
 * Exported so tests can render consumers (like `useArrivals`) with a
 * frozen snapshot via `<RealtimeFeedContext.Provider value={...}>` —
 * avoiding the need to drive the real provider's fetch lifecycle when
 * the unit under test isn't doing any polling work itself.
 */
export const RealtimeFeedContext = createContext<RealtimeFeedSnapshot | null>(null);

export function RealtimeFeedProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InternalState>(INITIAL_STATE);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Trip updates are the primary signal; vehicle positions add
      // occupancy. A vehiclePositions failure must not break the
      // primary "is my bus coming?" answer — we drop occupancy and
      // surface the rest. See docs/data-and-apis.md.
      const [tripResult, vehicleResult] = await Promise.allSettled([
        fetchTripUpdates(controller.signal),
        fetchVehiclePositions(controller.signal),
      ]);
      if (controller.signal.aborted) return;

      if (tripResult.status === 'rejected') {
        throw tripResult.reason instanceof Error
          ? tripResult.reason
          : new Error(String(tripResult.reason));
      }

      const vehiclePositions =
        vehicleResult.status === 'fulfilled' ? vehicleResult.value.vehicles : [];

      setState({
        status: 'success',
        tripUpdates: tripResult.value.trips,
        vehiclePositions,
        lastUpdated: Math.floor(Date.now() / 1000),
        isStale: false,
        error: null,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      setState((prev) => {
        if (prev.status === 'success') {
          return { ...prev, isStale: true, error };
        }
        return {
          status: 'error',
          tripUpdates: [],
          vehiclePositions: [],
          lastUpdated: null,
          isStale: false,
          error,
        };
      });
    }
  }, []);

  useEffect(() => {
    let unmounted = false;

    function clearTimer(): void {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function schedule(): void {
      clearTimer();
      timeoutRef.current = setTimeout(async () => {
        if (unmounted) return;
        if (document.visibilityState === 'visible') {
          await doFetch();
        }
        if (!unmounted && document.visibilityState === 'visible') {
          schedule();
        }
      }, POLL_INTERVAL_MS);
    }

    function handleVisibility(): void {
      if (document.visibilityState === 'visible') {
        void doFetch();
        schedule();
      } else {
        clearTimer();
      }
    }

    void doFetch();
    schedule();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unmounted = true;
      clearTimer();
      abortRef.current?.abort();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [doFetch]);

  const value = useMemo<RealtimeFeedSnapshot>(
    () => ({
      status: state.status,
      tripUpdates: state.tripUpdates,
      vehiclePositions: state.vehiclePositions,
      lastUpdated: state.lastUpdated,
      isStale: state.isStale,
      error: state.error,
      refresh: doFetch,
    }),
    [state, doFetch],
  );

  return <RealtimeFeedContext.Provider value={value}>{children}</RealtimeFeedContext.Provider>;
}

export function useRealtimeFeed(): RealtimeFeedSnapshot {
  const ctx = useContext(RealtimeFeedContext);
  if (ctx === null) {
    throw new Error('useRealtimeFeed must be called inside a RealtimeFeedProvider.');
  }
  return ctx;
}
