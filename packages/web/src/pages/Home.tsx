import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, ListItem, MessageCard, SearchInput } from '@atl-transit/components';

import { useFavorites } from '../features/favorites/FavoritesContext';
import { FavoriteStopCard } from '../features/favorites/FavoriteStopCard';
import { InstallPrompt } from '../features/install/InstallPrompt';
import { NearbyStops } from '../features/nearby/NearbyStops';
import { useGtfsRepository } from '../services/gtfs/GtfsRepositoryContext';
import { rankStops } from '../features/search/searchMatch';
import { formatDirections, directionsStringsFromT } from '../utils/directionsLabel';
import { DirectionLabel } from '../features/stops/DirectionLabel';
import type { StopOut } from '../buildtime/preprocessGtfs';
import type { Favorite } from '../services/storage';
import type { MoveDirection } from '../features/favorites/reorder';

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

function DefaultHome({ favorites }: { favorites: Favorite[] }) {
  const { t } = useTranslation();
  return (
    <>
      <FavoritesSection favorites={favorites} />

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

/**
 * The favorites list, with an inline Reorder / Done toggle that appears
 * only when there are 2+ favorites (one favorite has no neighbor to swap
 * with). Reorder state is local — leaving Home or dropping below 2
 * favorites resets the mode, so reorder behaves like a transient
 * activity rather than sticky chrome.
 *
 * Move results are announced via an sr-only polite live region (the
 * canonical role="status"); sighted users get the same confirmation for
 * free from the visible DOM reorder, so we avoid the toast noise.
 */
function FavoritesSection({ favorites }: { favorites: Favorite[] }) {
  const { t } = useTranslation();
  const { move } = useFavorites();
  const [userWantsReorder, setUserWantsReorder] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Reorder mode is derived, not stored. Dropping below 2 favorites (e.g.
  // the user removed one in another tab) silently ends the mode on the
  // next render — no effect, no cascade, no stale state.
  const canReorder = favorites.length >= 2;
  const isReordering = userWantsReorder && canReorder;

  const handleMove = (stopId: string, direction: MoveDirection) => {
    const index = favorites.findIndex((f) => f.stopId === stopId);
    if (index === -1) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= favorites.length) return;

    move(stopId, direction);

    const stop = favorites[index];
    if (!stop) return;
    setAnnouncement(
      t('favorites.moveAnnouncement', {
        stopName: stopNameFor(stopId),
        position: nextIndex + 1,
        total: favorites.length,
      }),
    );
  };

  // Resolve stop names via the repo so the announcement uses the same
  // human label the user sees on the card.
  const repo = useGtfsRepository();
  function stopNameFor(stopId: string): string {
    return repo.getStop(stopId)?.name ?? `Stop ${stopId}`;
  }

  return (
    <section aria-labelledby="favorites-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="favorites-heading" className="text-lg font-semibold">
          {t('home.myStops')}
        </h2>
        {canReorder && (
          <Button
            variant="neutral"
            aria-pressed={isReordering}
            onClick={() => {
              setUserWantsReorder((prev) => !prev);
              setAnnouncement('');
            }}
          >
            {isReordering ? t('favorites.reorderDone') : t('favorites.reorderEnter')}
          </Button>
        )}
      </div>

      {favorites.length === 0 ? (
        <EmptyState />
      ) : (
        <ul aria-labelledby="favorites-heading" className="space-y-2">
          {favorites.map((fav, i) => (
            <li key={fav.stopId}>
              <FavoriteStopCard
                stopId={fav.stopId}
                mode={isReordering ? 'reorder' : 'browse'}
                canMoveUp={i > 0}
                canMoveDown={i < favorites.length - 1}
                onMove={(dir) => {
                  handleMove(fav.stopId, dir);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <div
        role="status"
        aria-live="polite"
        aria-label={t('favorites.reorderAnnouncementsLabel')}
        className="sr-only"
      >
        {announcement}
      </div>
    </section>
  );
}

function SearchResults({ query, results }: { query: string; results: StopOut[] }) {
  const { t } = useTranslation();
  const repo = useGtfsRepository();
  const strings = directionsStringsFromT(t);

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
          const directions = formatDirections(
            stop.directions,
            (routeId) => repo.getRoute(routeId)?.shortName ?? routeId,
            strings,
          );
          return (
            <li key={stop.stopId}>
              <Link
                to={`/stop/${stop.stopId}`}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ListItem
                  variant="row"
                  interactive
                  title={stop.name}
                  secondary={directions ? <DirectionLabel value={directions} /> : undefined}
                />
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
