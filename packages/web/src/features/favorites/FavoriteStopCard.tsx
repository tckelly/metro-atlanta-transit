/**
 * Compact home-screen tile for a single favorited stop. With the
 * shared realtime feed (RealtimeFeedProvider) in place, all favorite
 * cards on Home consume one polling cycle — the previous "N favorites
 * → N fetches" cost is gone.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@atl-transit/components';

import { useArrivals } from '../stops/useArrivals';
import { toBusRowProps } from '../stops/busRowMapper';
import { useGtfsRepository } from '../../services/gtfs/GtfsRepositoryContext';
import { useFormatTime } from '../../i18n/formatters';
import { useNowSec } from '../../utils/useNowSec';

const PREVIEW_COUNT = 2;

export interface FavoriteStopCardProps {
  stopId: string;
}

export function FavoriteStopCard({ stopId }: FavoriteStopCardProps) {
  const { t } = useTranslation();
  const repo = useGtfsRepository();
  const formatTime = useFormatTime();
  const { status, rows } = useArrivals(stopId);
  const nowSec = useNowSec(15_000);
  const stop = repo.getStop(stopId);
  const stopName = stop?.name ?? `Stop ${stopId}`;

  const preview = rows.slice(0, PREVIEW_COUNT);

  return (
    <Link
      to={`/stop/${stopId}`}
      className="block rounded border border-divider bg-surface-elevated p-4 transition-colors hover:border-primary"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">{stopName}</div>
        <span aria-hidden="true" className="text-fg-muted">
          ›
        </span>
      </div>

      <div className="mt-2 text-sm">
        {status === 'loading' && (
          <div
            role="status"
            aria-live="polite"
            aria-label={t('loading.arrivals')}
            className="space-y-2"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {status === 'error' && (
          <span className="text-status-cancelled">{t('favorites.loadError')}</span>
        )}
        {status === 'success' && preview.length === 0 && (
          <span className="text-fg-muted">{t('favorites.noUpcoming')}</span>
        )}
        {status === 'success' && preview.length > 0 && (
          <ul className="space-y-1">
            {preview.map((row) => {
              const route = repo.getRoute(row.routeId);
              const shortName = route?.shortName ?? row.routeId;
              const props = toBusRowProps(row, nowSec, { t, formatTime });
              return (
                <li key={row.tripId} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-fg">
                    {t('favorites.rowPreview', { shortName, headsign: row.headsign })}
                  </span>
                  <span className={severityClass(props.severity)}>{props.primaryText}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Link>
  );
}

function severityClass(severity: 'success' | 'warning' | 'danger' | 'neutral'): string {
  switch (severity) {
    case 'success':
      return 'whitespace-nowrap font-semibold text-status-live';
    case 'warning':
      return 'whitespace-nowrap font-semibold text-status-warn';
    case 'danger':
      return 'whitespace-nowrap font-semibold text-status-cancelled';
    case 'neutral':
      return 'whitespace-nowrap font-semibold text-fg';
  }
}
