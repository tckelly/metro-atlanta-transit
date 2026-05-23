import { useEffect, useState } from 'react';

import { loadGtfsBundle } from './gtfsStatic';
import type { GtfsBundle } from '../buildtime/preprocessGtfs';

/**
 * Module-level cache of the static GTFS bundle. Loaded once per app
 * session and shared across components — multiple StopDetail mounts
 * don't trigger duplicate fetches.
 *
 * The service worker (vite-plugin-pwa, forthcoming) will precache the
 * underlying JSON files so this resolves from cache after first install.
 */
let cachedBundle: GtfsBundle | null = null;
let pendingLoad: Promise<GtfsBundle> | null = null;

export interface UseGtfsBundleResult {
  bundle: GtfsBundle | null;
  loading: boolean;
  error: Error | null;
}

export function useGtfsBundle(): UseGtfsBundleResult {
  const [state, setState] = useState<UseGtfsBundleResult>(() =>
    cachedBundle
      ? { bundle: cachedBundle, loading: false, error: null }
      : { bundle: null, loading: true, error: null },
  );

  useEffect(() => {
    if (cachedBundle) return;
    if (!pendingLoad) {
      pendingLoad = loadGtfsBundle().then((b) => {
        cachedBundle = b;
        return b;
      });
    }

    let cancelled = false;
    pendingLoad.then(
      (bundle) => {
        if (!cancelled) setState({ bundle, loading: false, error: null });
      },
      (err) => {
        pendingLoad = null; // allow retry
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
