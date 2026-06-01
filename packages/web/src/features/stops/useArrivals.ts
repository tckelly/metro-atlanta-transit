/**
 * Per-stop arrivals derived from the shared realtime feed.
 *
 * The hook merges two sources:
 *   1. Scheduled visits for the stop on `date`, fetched from the
 *      `GtfsRepository`. In-memory today; backend in the future.
 *      Async, so we hold them in state and refresh on inputs change.
 *   2. The latest realtime snapshot from `RealtimeFeedProvider`.
 *      One polling loop for the whole app; consumers read from it.
 *
 * Returns the discriminated `UseArrivalsResult` callers already know.
 * Consumers don't see the async-ness of scheduled visits — while the
 * fetch is in flight the hook keeps `status = 'loading'`.
 */
import { useEffect, useMemo, useState } from 'react';

import { useGtfsRepository } from '../../services/gtfs/GtfsRepositoryContext';
import { todayServiceDate } from '../../utils/serviceDate';
import { useNowSec } from '../../utils/useNowSec';
import { useRealtimeFeed } from '../realtime/RealtimeFeedContext';
import { classifyBusRows, type ClassifiedBusRow, type ScheduledStopVisit } from './busRowClassifier';

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
  /**
   * Force an immediate refresh of the shared feed. Returns the
   * underlying fetch promise so callers (e.g., pull-to-refresh) can
   * await completion; callers that don't care can just call it.
   */
  refresh: () => Promise<void>;
}

export function useArrivals(
  stopId: string,
  options: { date?: string } = {},
): UseArrivalsResult {
  const date = options.date ?? todayServiceDate();
  const repo = useGtfsRepository();
  const feed = useRealtimeFeed();
  const nowSec = useNowSec(WINDOW_TICK_MS);
  const [scheduledVisits, setScheduledVisits] = useState<ScheduledStopVisit[]>([]);
  const [scheduledError, setScheduledError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    repo
      .getScheduledVisitsForStop({ stopId, date, nowSec })
      .then((visits) => {
        if (!cancelled) {
          setScheduledVisits(visits);
          setScheduledError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setScheduledError(err instanceof Error ? err : new Error(String(err)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [repo, stopId, date, nowSec]);

  const rows = useMemo<ClassifiedBusRow[]>(() => {
    if (feed.status === 'loading' || feed.status === 'error') return [];
    return classifyBusRows({
      scheduledVisits,
      tripUpdates: feed.tripUpdates,
      vehiclePositions: feed.vehiclePositions,
      stopId,
    });
  }, [feed.status, feed.tripUpdates, feed.vehiclePositions, scheduledVisits, stopId]);

  return {
    status: feed.status,
    rows,
    lastUpdated: feed.lastUpdated,
    isStale: feed.isStale,
    error: feed.error ?? scheduledError,
    refresh: () => feed.refresh(),
  };
}
