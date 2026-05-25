import { useFavorites } from '../features/favorites/FavoritesContext';
import { FavoriteStopCard } from '../features/favorites/FavoriteStopCard';
import { NearbyStops } from '../features/nearby/NearbyStops';
import { useGtfsBundle } from '../services/useGtfsBundle';

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

      {!bundleLoading && !bundleError && bundle !== null && <NearbyStops bundle={bundle} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-divider bg-surface-elevated p-4">
      <p className="font-semibold">No favorites yet</p>
      <p className="mt-1 text-sm text-fg-muted">
        Find a stop below and tap the star on its page to keep it here for your commute.
      </p>
    </div>
  );
}
