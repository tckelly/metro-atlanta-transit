/**
 * Loads only the client-side reference data (stops + routes) — the
 * tables HybridGtfsRepository needs in memory for sync metadata
 * lookups. Big tables (trips, stop_times, calendar) stay on the
 * backend per ADR-0006.
 *
 * Same module-level cache pattern as the previous `useGtfsBundle`:
 * one fetch per app session, shared across mounts.
 */
import { useEffect, useState } from 'react';

import type { RouteOut, StopOut } from '../buildtime/preprocessGtfs';
import type { SmallGtfsBundle } from './gtfs/HybridGtfsRepository';

let cached: SmallGtfsBundle | null = null;
let pending: Promise<SmallGtfsBundle> | null = null;

export interface UseSmallGtfsBundleResult {
  bundle: SmallGtfsBundle | null;
  loading: boolean;
  error: Error | null;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(
      `Failed to load ${path}: ${res.status} ${res.statusText}. ` +
        `Did you run \`pnpm preprocess-gtfs\` to generate the static GTFS bundle?`,
    );
  }
  return res.json() as Promise<T>;
}

async function loadSmallBundle(): Promise<SmallGtfsBundle> {
  const [stops, routes] = await Promise.all([
    fetchJson<StopOut[]>('/gtfs/stops.json'),
    fetchJson<RouteOut[]>('/gtfs/routes.json'),
  ]);
  return { stops, routes };
}

export function useSmallGtfsBundle(): UseSmallGtfsBundleResult {
  const [state, setState] = useState<UseSmallGtfsBundleResult>(() =>
    cached !== null
      ? { bundle: cached, loading: false, error: null }
      : { bundle: null, loading: true, error: null },
  );

  useEffect(() => {
    if (cached !== null) return;
    if (pending === null) {
      pending = loadSmallBundle().then((b) => {
        cached = b;
        return b;
      });
    }

    let cancelled = false;
    pending.then(
      (bundle) => {
        if (!cancelled) setState({ bundle, loading: false, error: null });
      },
      (err: unknown) => {
        pending = null;
        if (!cancelled) {
          setState({
            bundle: null,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
