/**
 * Browse-by-route entry point. Lists every route in the repository in
 * natural order (so "10" sorts after "9", not after "1").
 *
 * The BundleGate in App.tsx blocks rendering until the repository is
 * populated, so this page never needs its own loading or error state
 * for the static data.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCard, SearchInput } from '@atl-transit/components';

import { useGtfsRepository } from '../services/gtfs/GtfsRepositoryContext';
import { matchesQuery } from '../features/search/searchMatch';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function Routes() {
  const { t } = useTranslation();
  const repo = useGtfsRepository();
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    () =>
      [...repo.listRoutes()].sort((a, b) => naturalCollator.compare(a.shortName, b.shortName)),
    [repo],
  );

  const filtered = useMemo(() => {
    if (query.trim() === '') return sorted;
    return sorted.filter(
      (r) => matchesQuery(r.shortName, query) || matchesQuery(r.longName, query),
    );
  }, [sorted, query]);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label={t('routes.backToHome')} className="text-2xl text-primary">
          ←
        </Link>
        <h1 className="text-xl font-bold">{t('routes.title')}</h1>
      </header>

      <SearchInput
        value={query}
        onChange={setQuery}
        aria-label={t('routes.searchLabel')}
        clearLabel={t('routes.searchClearLabel')}
        placeholder={t('routes.searchPlaceholder')}
      />

      {filtered.length === 0 ? (
        <MessageCard
          title={t('routes.noMatchesTitle')}
          body={t('routes.noMatchesBody', { query })}
        />
      ) : (
        <ul className="divide-y divide-divider rounded border border-divider bg-surface-elevated">
          {filtered.map((route) => (
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
