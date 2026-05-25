import { Link } from 'react-router-dom';

import { useFavorites } from '../features/favorites/FavoritesContext';
import { FavoriteStopCard } from '../features/favorites/FavoriteStopCard';
import { useGtfsBundle } from '../services/useGtfsBundle';

// Curated starting points for empty-state dogfood. M4 will replace this
// with nearby-stops / browse-by-route; until then, a stranger opening the
// app has no other way to discover stops.
const TRY_A_STOP = [
  { stopId: '902990', name: 'Virginia Ave @ Todd Rd (Westbound)' },
  { stopId: '904428', name: 'Ponce de Leon @ Barnett St (Westbound)' },
];

export function Home() {
  const { favorites } = useFavorites();
  const { bundle, loading: bundleLoading, error: bundleError } = useGtfsBundle();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Atlanta Transit</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Real-time MARTA bus arrivals. Unofficial.
        </p>
      </header>

      <section aria-labelledby="favorites-heading" className="space-y-3">
        <h2 id="favorites-heading" className="text-lg font-semibold">
          My stops
        </h2>

        {bundleLoading && (
          <p className="text-sm text-fg-muted">Loading schedule data…</p>
        )}
        {bundleError && (
          <p className="text-sm text-status-cancelled">
            Couldn’t load schedule data: {bundleError.message}
          </p>
        )}

        {!bundleLoading && !bundleError && bundle !== null && (
          favorites.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2">
              {favorites.map((fav) => (
                <li key={fav.stopId}>
                  <FavoriteStopCard stopId={fav.stopId} bundle={bundle} />
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="space-y-4 rounded border border-divider bg-surface-elevated p-4">
      <div>
        <p className="font-semibold">No favorites yet</p>
        <p className="mt-1 text-sm text-fg-muted">
          Open a stop and tap the star to keep it here for your commute.
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold">Try a stop:</p>
        <ul className="mt-2 space-y-1">
          {TRY_A_STOP.map((stop) => (
            <li key={stop.stopId}>
              <Link
                to={`/stop/${stop.stopId}`}
                className="text-sm text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {stop.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
