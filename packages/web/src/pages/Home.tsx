import { Link } from 'react-router-dom';
import { MessageCard } from '@atl-transit/components';

import { useFavorites } from '../features/favorites/FavoritesContext';
import { FavoriteStopCard } from '../features/favorites/FavoriteStopCard';
import { NearbyStops } from '../features/nearby/NearbyStops';

export function Home() {
  const { favorites } = useFavorites();

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

        {favorites.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {favorites.map((fav) => (
              <li key={fav.stopId}>
                <FavoriteStopCard stopId={fav.stopId} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <NearbyStops />

      <p className="text-sm">
        <Link
          to="/routes"
          className="text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Browse all routes →
        </Link>
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <MessageCard
      title="No favorites yet"
      titleAs="p"
      body="Find a stop below and tap the star on its page to keep it here for your commute."
    />
  );
}
