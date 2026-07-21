import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Icon, LineIndicator, ListItem, MessageCard, Skeleton } from '@atl-transit/components';

import type { RailStation } from './railStations';
import { railLineToken, railLineLabel } from './railLine';

export interface RailStationsViewProps {
  status: 'loading' | 'success' | 'error';
  stations: RailStation[];
  error: Error | null;
  onRefresh: () => void;
}

/**
 * Presentational rail station directory: a list of stations, each linking to
 * its station-detail page and showing the lines that serve it. Reuses the
 * shared `ListItem` row idiom (a `group`-wrapped `<Link>`), so it matches the
 * bus stop/route lists. Container owns the data.
 */
export function RailStationsView({ status, stations, error, onRefresh }: RailStationsViewProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label={t('rail.stationList.back')} className="text-2xl text-primary">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{t('rail.stationList.title')}</h1>
      </header>

      {status === 'loading' && <StationsLoading label={t('rail.stationList.loading')} />}

      {status === 'error' && (
        <StationsError
          error={error}
          title={t('rail.stationList.errorTitle')}
          body={t('rail.stationList.errorBody')}
        />
      )}

      {status === 'success' && stations.length === 0 && (
        <MessageCard
          title={t('rail.stationList.emptyTitle')}
          body={t('rail.stationList.emptyBody')}
        />
      )}

      {status === 'success' && stations.length > 0 && (
        <ul className="divide-y divide-divider rounded border border-divider bg-surface-elevated">
          {stations.map((s) => (
            <li key={s.name}>
              <Link
                to={`/station/${encodeURIComponent(s.name)}`}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ListItem
                  variant="row"
                  interactive
                  title={s.displayName}
                  secondary={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {s.lines.map((line) => (
                        <LineIndicator key={line} line={railLineToken(line)}>
                          {railLineLabel(line, t)}
                        </LineIndicator>
                      ))}
                    </span>
                  }
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(status === 'success' || status === 'error') && (
        <div className="flex justify-end">
          <Button variant="neutral" onClick={onRefresh} className="gap-1.5 px-3">
            <Icon name="refresh" />
            {t('rail.stationList.refresh')}
          </Button>
        </div>
      )}
    </div>
  );
}

function StationsLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <ul className="divide-y divide-divider rounded border border-divider bg-surface-elevated">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="space-y-2 px-4 py-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StationsError({ error, title, body }: { error: Error | null; title: string; body: string }) {
  useEffect(() => {
    if (error !== null) console.error('RailStations: failed to load', error);
  }, [error]);
  return <MessageCard title={title} body={body} />;
}
