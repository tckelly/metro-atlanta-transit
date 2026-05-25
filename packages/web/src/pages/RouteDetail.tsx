/**
 * Route detail — header + one stop list per headsign direction.
 *
 * Each stop is a link to /stop/:stopId so the user can pivot from
 * route-discovery into "what's coming next at this stop" without
 * typing a stop ID.
 *
 * `getRouteDirections` is async on the repository — InMemory resolves
 * immediately, the future backend impl issues a query. Either way the
 * loading state below covers the gap.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCard, SearchInput, Skeleton } from '@atl-transit/components';

import { useGtfsRepository } from '../services/gtfs/GtfsRepositoryContext';
import { matchesQuery } from '../features/search/searchStops';
import type { RouteDirection } from '../features/routes/getRouteDirections';

type State =
  | { kind: 'loading' }
  | { kind: 'success'; directions: RouteDirection[] }
  | { kind: 'error' };

export function RouteDetail() {
  const { t } = useTranslation();
  const { routeId } = useParams<{ routeId: string }>();
  const repo = useGtfsRepository();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (routeId === undefined) return;
    let cancelled = false;
    // Reset state when routeId changes — an intentional setState in an
    // effect to drop stale data while the new fetch is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    repo
      .getRouteDirections(routeId)
      .then((directions) => {
        if (!cancelled) setState({ kind: 'success', directions });
      })
      .catch((err: unknown) => {
        // Surface the technical detail to developers via the console;
        // the UI shows a generic, user-meaningful message regardless
        // so we don't leak architecture (paths, HTTP statuses, etc.)
        // to public users.
        console.error('RouteDetail: failed to load route directions', err);
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [repo, routeId]);

  const [query, setQuery] = useState('');
  const filteredDirections = useMemo<RouteDirection[]>(() => {
    if (state.kind !== 'success') return [];
    if (query.trim() === '') return state.directions;
    return state.directions
      .map((d) => ({ ...d, stops: d.stops.filter((s) => matchesQuery(s.name, query)) }))
      .filter((d) => d.stops.length > 0);
  }, [state, query]);

  if (routeId === undefined) {
    return <MessageCard title={t('routeDetail.noRouteIdTitle')} body={t('routeDetail.noRouteIdBody')} />;
  }

  const route = repo.getRoute(routeId);
  const shortName = route?.shortName ?? routeId;
  const longName = route?.longName ?? '';

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/routes" aria-label={t('routeDetail.backToRoutes')} className="text-2xl text-primary">
          ←
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{t('routeDetail.headerPrefix', { shortName })}</h1>
          {longName !== '' && <p className="truncate text-sm text-fg-muted">{longName}</p>}
        </div>
      </header>

      {state.kind === 'success' && state.directions.length > 0 && (
        <SearchInput
          value={query}
          onChange={setQuery}
          aria-label={t('routeDetail.searchLabel')}
          clearLabel={t('routeDetail.searchClearLabel')}
          placeholder={t('routeDetail.searchPlaceholder')}
        />
      )}

      {state.kind === 'loading' && <RouteLoadingSkeleton />}

      {state.kind === 'error' && (
        <MessageCard
          title={t('routeDetail.loadErrorTitle')}
          body={t('routeDetail.loadErrorBody')}
        />
      )}

      {state.kind === 'success' && state.directions.length === 0 && (
        <MessageCard
          title={t('routeDetail.noStopsTitle')}
          body={t('routeDetail.noStopsBody')}
        />
      )}

      {state.kind === 'success' && state.directions.length > 0 && filteredDirections.length === 0 && (
        <MessageCard
          title={t('routeDetail.noMatchesTitle')}
          body={t('routeDetail.noMatchesBody', { query })}
        />
      )}

      {state.kind === 'success' && filteredDirections.map((direction) => (
          <section key={direction.headsign} aria-labelledby={`dir-${direction.headsign}`}>
            <h2 id={`dir-${direction.headsign}`} className="text-base font-semibold">
              {t('routeDetail.toward', { headsign: direction.headsign })}
            </h2>
            <ol className="mt-2 divide-y divide-divider rounded border border-divider bg-surface-elevated">
              {direction.stops.map((stop) => (
                <li key={stop.stopId}>
                  <Link
                    to={`/stop/${stop.stopId}`}
                    className="block px-4 py-3 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {stop.name}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
    </div>
  );
}

/**
 * Two direction sections with skeleton bars for header + a handful
 * of stop names. Matches the shape RouteDetail renders on success so
 * the layout doesn't shift when data arrives.
 */
function RouteLoadingSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" aria-label={t('loading.route')}>
      <span className="sr-only">{t('loading.routeDots')}</span>
      {[0, 1].map((dirIdx) => (
        <section key={dirIdx} className="mt-6 first:mt-0">
          <Skeleton className="h-5 w-32" />
          <ol className="mt-2 divide-y divide-divider rounded border border-divider bg-surface-elevated">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-48" />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
