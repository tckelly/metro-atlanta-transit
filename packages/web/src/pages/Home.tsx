import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCard } from '@atl-transit/components';

import { useFavorites } from '../features/favorites/FavoritesContext';
import { FavoriteStopCard } from '../features/favorites/FavoriteStopCard';
import { InstallPrompt } from '../features/install/InstallPrompt';
import { NearbyStops } from '../features/nearby/NearbyStops';

export function Home() {
  const { t } = useTranslation();
  const { favorites } = useFavorites();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('app.name')}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t('app.tagline')}</p>
      </header>

      <section aria-labelledby="favorites-heading" className="space-y-3">
        <h2 id="favorites-heading" className="text-lg font-semibold">
          {t('home.myStops')}
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
          {t('home.browseRoutes')}
        </Link>
      </p>

      <InstallPrompt />

      <p className="text-sm">
        <Link
          to="/settings"
          className="text-fg-muted underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t('settings.homeLink')}
        </Link>
      </p>
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <MessageCard
      title={t('home.favoritesEmptyTitle')}
      titleAs="p"
      body={t('home.favoritesEmptyBody')}
    />
  );
}
