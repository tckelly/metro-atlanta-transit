import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCard, SearchInput } from '@atl-transit/components';

import { useFavorites } from '../features/favorites/FavoritesContext';
import { FavoriteStopCard } from '../features/favorites/FavoriteStopCard';
import { InstallPrompt } from '../features/install/InstallPrompt';
import { NearbyStops } from '../features/nearby/NearbyStops';
import { useGtfsRepository } from '../services/gtfs/GtfsRepositoryContext';
import { rankStops } from '../features/search/searchStops';
import type { StopOut } from '../buildtime/preprocessGtfs';

/** Maximum rows in the search-result list. Keeps scroll cheap on phones. */
const SEARCH_RESULT_LIMIT = 20;

export function Home() {
  const { t } = useTranslation();
  const { favorites } = useFavorites();
  const repo = useGtfsRepository();
  const [query, setQuery] = useState('');

  const results = useMemo<StopOut[]>(
    () => (query.trim() === '' ? [] : rankStops(repo.listStops(), query, SEARCH_RESULT_LIMIT)),
    [query, repo],
  );
  const isSearching = query.trim() !== '';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('app.name')}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t('app.tagline')}</p>
      </header>

      <SearchInput
        value={query}
        onChange={setQuery}
        aria-label={t('home.searchLabel')}
        clearLabel={t('home.searchClearLabel')}
        placeholder={t('home.searchPlaceholder')}
      />

      {isSearching ? (
        <SearchResults query={query} results={results} />
      ) : (
        <DefaultHome favorites={favorites} />
      )}

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

function DefaultHome({ favorites }: { favorites: { stopId: string }[] }) {
  const { t } = useTranslation();
  return (
    <>
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
    </>
  );
}

function SearchResults({ query, results }: { query: string; results: StopOut[] }) {
  const { t } = useTranslation();
  const repo = useGtfsRepository();

  if (results.length === 0) {
    return (
      <MessageCard
        title={t('home.searchNoMatchesTitle')}
        body={t('home.searchNoMatchesBody', { query })}
      />
    );
  }

  return (
    <section aria-labelledby="search-results-heading" className="space-y-2">
      <h2 id="search-results-heading" className="sr-only">
        {t('home.searchResultsHeading')}
      </h2>
      <ul className="divide-y divide-divider rounded border border-divider bg-surface-elevated">
        {results.map((stop) => {
          const routeShortNames = stop.routeIds
            .map((rid) => repo.getRoute(rid)?.shortName ?? rid)
            .join(', ');
          return (
            <li key={stop.stopId}>
              <Link
                to={`/stop/${stop.stopId}`}
                className="block px-4 py-3 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="block text-fg">{stop.name}</span>
                {routeShortNames !== '' && (
                  <span className="mt-0.5 block text-xs text-fg-muted">
                    {t('home.searchRoutesLine', { routes: routeShortNames })}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
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
