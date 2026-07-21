import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrivalRow, Button, Icon, LineIndicator, MessageCard, Skeleton } from '@atl-transit/components';

import type { RailLineGroup } from './groupArrivalsByLineDestination';
import { toRailRowProps } from './railRowMapper';
import { railLineToken, railLineLabel } from './railLine';
import { DirectionLabel } from '../stops/DirectionLabel';
import { formatLastUpdated } from '../../utils/formatLastUpdated';

export interface StationDetailViewProps {
  /** Display name, already resolved/title-cased by the container. */
  stationName: string;
  status: 'loading' | 'success' | 'error';
  groups: RailLineGroup[];
  lastUpdated: number | null;
  isStale: boolean;
  error: Error | null;
  onRefresh: () => void;
  nowSec: number;
  /** Locale/prefs-aware clock formatter, injected by the container so this View stays settings-context-free. */
  formatTime: (unixSec: number) => string;
}

/**
 * Presentational station-detail surface: given already-grouped rail arrivals,
 * renders the same shell as the bus stop-detail (header, loading/error/empty/
 * success states, last-updated + refresh) minus the disclosure and favorites.
 * Domain → visual mapping happens here (ADR-0003); the container owns data.
 */
export function StationDetailView({
  stationName,
  status,
  groups,
  lastUpdated,
  isStale,
  error,
  onRefresh,
  nowSec,
  formatTime,
}: StationDetailViewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label={t('rail.stationDetail.back')} className="text-2xl text-primary">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{stationName}</h1>
      </header>

      {status === 'loading' && <StationLoading label={t('rail.stationDetail.loading')} />}

      {status === 'error' && (
        <StationError
          error={error}
          title={t('rail.stationDetail.errorTitle')}
          body={t('rail.stationDetail.errorBody')}
        />
      )}

      {status === 'success' && groups.length === 0 && (
        <MessageCard
          title={t('rail.stationDetail.emptyTitle')}
          body={t('rail.stationDetail.emptyBody')}
        />
      )}

      {status === 'success' && groups.length > 0 && (
        <div className="space-y-6">
          {groups.map((g) => (
            <LineSection
              key={`${g.line} ${g.destination}`}
              group={g}
              nowSec={nowSec}
              formatTime={formatTime}
            />
          ))}
        </div>
      )}

      {(status === 'success' || status === 'error') && (
        <div className="flex items-center justify-between gap-3">
          <span className={isStale ? 'text-sm text-status-warn' : 'text-sm text-fg-muted'}>
            {lastUpdated !== null &&
              `${t('rail.stationDetail.lastUpdatedPrefix')} ${formatLastUpdated(lastUpdated, nowSec, t)}`}
          </span>
          <Button variant="neutral" onClick={onRefresh} className="gap-1.5 px-3">
            <Icon name="refresh" />
            {t('rail.stationDetail.refresh')}
          </Button>
        </div>
      )}
    </div>
  );
}

function LineSection({
  group,
  nowSec,
  formatTime,
}: {
  group: RailLineGroup;
  nowSec: number;
  formatTime: (unixSec: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
        <LineIndicator line={railLineToken(group.line)}>{railLineLabel(group.line, t)}</LineIndicator>
        <DirectionLabel
          value={{
            visible: `→ ${group.destination}`,
            label: t('rail.towardDestination', { destination: group.destination }),
          }}
        />
      </h2>
      <ul className="mt-2 divide-y divide-divider">
        {group.arrivals.map((a) => (
          <ArrivalRow key={a.trainId} {...toRailRowProps(a, nowSec, { t, formatTime })} />
        ))}
      </ul>
    </section>
  );
}

function StationLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <ul className="divide-y divide-divider">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3 py-3">
            <Skeleton className="mt-1 h-5 w-5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StationError({ error, title, body }: { error: Error | null; title: string; body: string }) {
  useEffect(() => {
    // Rider sees a stable message; technical detail goes to the console only
    // (never the DOM on a public site) — mirrors the bus ErrorCard.
    if (error !== null) console.error('StationDetail: arrivals failed to load', error);
  }, [error]);
  return <MessageCard title={title} body={body} />;
}
