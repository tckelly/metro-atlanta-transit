/**
 * Browse-by-route entry point. Lists every route in the repository in
 * natural order (so "10" sorts after "9", not after "1").
 *
 * The BundleGate in App.tsx blocks rendering until the repository is
 * populated, so this page never needs its own loading or error state
 * for the static data.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useGtfsRepository } from '../services/gtfs/GtfsRepositoryContext';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function Routes() {
  const repo = useGtfsRepository();

  const sorted = useMemo(
    () =>
      [...repo.listRoutes()].sort((a, b) => naturalCollator.compare(a.shortName, b.shortName)),
    [repo],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label="Back to home" className="text-2xl text-primary">
          ←
        </Link>
        <h1 className="text-xl font-bold">All routes</h1>
      </header>

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
    </div>
  );
}
