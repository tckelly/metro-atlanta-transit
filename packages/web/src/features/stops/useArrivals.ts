import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchTripUpdates } from '../../services/martaRealtime';
import { getScheduledVisitsForStop } from '../../services/gtfsStatic';
import { classifyBusRows, type ClassifiedBusRow } from './busRowClassifier';
import type { GtfsBundle } from '../../buildtime/preprocessGtfs';

/** 30 seconds — matches MARTA's own feed cadence (see docs/data-and-apis.md). */
const POLL_INTERVAL_MS = 30_000;

export interface UseArrivalsResult {
  status: 'loading' | 'success' | 'error';
  rows: ClassifiedBusRow[];
  /** Unix seconds of the last successful fetch; null if never succeeded. */
  lastUpdated: number | null;
  /** True when the most recent refresh failed but prior data is still shown. */
  isStale: boolean;
  error: Error | null;
  /** Force an immediate refresh outside the polling cadence. */
  refresh: () => void;
}

interface InternalState {
  status: 'loading' | 'success' | 'error';
  rows: ClassifiedBusRow[];
  lastUpdated: number | null;
  isStale: boolean;
  error: Error | null;
}

const INITIAL_STATE: InternalState = {
  status: 'loading',
  rows: [],
  lastUpdated: null,
  isStale: false,
  error: null,
};

function todayYYYYMMDD(): string {
  // Atlanta-local date for GTFS service-day resolution.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()).replace(/-/g, '');
}

/**
 * Live arrivals for a stop. Combines preprocessed static schedule with
 * realtime trip_updates, polls every 30s while the tab is visible, and
 * pauses while hidden. Returns a discriminated state shape so consumers
 * always handle loading / success / error explicitly.
 *
 * If a refresh fails after a prior success, the previous data stays
 * visible with `isStale = true` — never blank out what the user was
 * looking at.
 */
export function useArrivals(
  stopId: string,
  bundle: GtfsBundle,
  options: { date?: string } = {},
): UseArrivalsResult {
  const date = options.date ?? todayYYYYMMDD();

  const [state, setState] = useState<InternalState>(INITIAL_STATE);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const feed = await fetchTripUpdates(controller.signal);
      if (controller.signal.aborted) return;
      // Recompute scheduled visits with the current time, so the forward
      // window slides with each poll instead of being frozen at mount.
      const nowSec = Math.floor(Date.now() / 1000);
      const scheduledVisits = getScheduledVisitsForStop(bundle, stopId, date, { nowSec });
      const rows = classifyBusRows({
        scheduledVisits,
        tripUpdates: feed.trips,
        stopId,
      });
      setState({
        status: 'success',
        rows,
        lastUpdated: nowSec,
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
          rows: [],
          lastUpdated: null,
          isStale: false,
          error,
        };
      });
    }
  }, [bundle, stopId, date]);

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

  return {
    status: state.status,
    rows: state.rows,
    lastUpdated: state.lastUpdated,
    isStale: state.isStale,
    error: state.error,
    refresh: doFetch,
  };
}
