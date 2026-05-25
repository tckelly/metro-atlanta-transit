/**
 * Per-stop arrivals derived from the shared realtime feed.
 *
 * After M5's cache refactor (ADR-0005 era), the polling lifecycle moved
 * to `RealtimeFeedProvider` — one fetch loop for the whole app. This
 * hook is now a thin consumer: read the feed snapshot, slice scheduled
 * visits for `stopId`, classify, return. Multiple cards on Home that
 * call `useArrivals(...)` share one upstream cycle.
 */
import { useMemo } from 'react';

import { getScheduledVisitsForStop } from '../../services/gtfsStatic';
import { useNowSec } from '../../utils/useNowSec';
import { useRealtimeFeed } from '../realtime/RealtimeFeedContext';
import { classifyBusRows, type ClassifiedBusRow } from './busRowClassifier';
import type { GtfsBundle } from '../../buildtime/preprocessGtfs';

/**
 * The scheduled-visits window advances once per minute — the same rhythm
 * as the polling cadence, so the visible "next N buses" slides without
 * re-rendering on every tick.
 */
const WINDOW_TICK_MS = 60_000;

export interface UseArrivalsResult {
  status: 'loading' | 'success' | 'error';
  rows: ClassifiedBusRow[];
  /** Unix seconds of the last successful fetch; null if never succeeded. */
  lastUpdated: number | null;
  /** True when the most recent refresh failed but prior data is still shown. */
  isStale: boolean;
  error: Error | null;
  /** Force an immediate refresh of the shared feed. */
  refresh: () => void;
}

function todayYYYYMMDD(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()).replace(/-/g, '');
}

export function useArrivals(
  stopId: string,
  bundle: GtfsBundle,
  options: { date?: string } = {},
): UseArrivalsResult {
  const date = options.date ?? todayYYYYMMDD();
  const feed = useRealtimeFeed();
  const nowSec = useNowSec(WINDOW_TICK_MS);

  const rows = useMemo<ClassifiedBusRow[]>(() => {
    if (feed.status === 'loading' || feed.status === 'error') return [];
    const scheduledVisits = getScheduledVisitsForStop(bundle, stopId, date, { nowSec });
    return classifyBusRows({
      scheduledVisits,
      tripUpdates: feed.tripUpdates,
      vehiclePositions: feed.vehiclePositions,
      stopId,
    });
  }, [feed.status, feed.tripUpdates, feed.vehiclePositions, bundle, stopId, date, nowSec]);

  return {
    status: feed.status,
    rows,
    lastUpdated: feed.lastUpdated,
    isStale: feed.isStale,
    error: feed.error,
    refresh: () => {
      void feed.refresh();
    },
  };
}
