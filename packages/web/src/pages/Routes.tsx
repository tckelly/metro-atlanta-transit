/**
 * Browse-by-route entry point. Lists every route in the static GTFS
 * bundle in natural order (so "10" sorts after "9", not after "1").
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useGtfsBundle } from '../services/useGtfsBundle';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function Routes() {
  const { bundle, loading, error } = useGtfsBundle();

  const sorted = useMemo(() => {
    if (bundle === null) return [];
    return [...bundle.routes].sort((a, b) => naturalCollator.compare(a.shortName, b.shortName));
  }, [bundle]);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label="Back to home" className="text-2xl text-primary">
          ←
        </Link>
        <h1 className="text-xl font-bold">All routes</h1>
      </header>

      {loading && <p className="text-sm text-fg-muted">Loading routes…</p>}
      {error !== null && (
        <p className="text-sm text-status-cancelled">Couldn’t load routes: {error.message}</p>
      )}

      {!loading && error === null && bundle !== null && (
        <ul className="divide-y divide-divider rounded border border-divider bg-surface-elevated">
          {sorted.map((route) => (
            <li key={route.routeId}>
              <Link
                to={`/route/${route.routeId}`}
                className="flex items-baseline gap-3 px-4 py-3 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="min-w-[3ch] font-semibold">{route.shortName}</span>
                <span className="min-w-0 truncate text-sm text-fg-muted">{route.longName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
