import { Link, useParams } from 'react-router-dom';
import { BusRow, Button, Icon, MessageCard } from '@atl-transit/components';

import { useArrivals } from '../features/stops/useArrivals';
import { useGtfsBundle } from '../services/useGtfsBundle';
import { toBusRowProps } from '../features/stops/busRowMapper';
import { groupRowsByRoute, type RouteGroup } from '../features/stops/groupRowsByRoute';
import { getRouteMetadata, getStopMetadata } from '../services/gtfsStatic';
import { FavoriteStarButton } from '../features/favorites/FavoriteStarButton';
import { assessDisruption } from '../features/disruption/assessDisruption';
import { DisruptionBadge } from '../features/disruption/DisruptionBadge';
import { formatLastUpdated } from '../utils/formatLastUpdated';
import { freshnessTier, type FreshnessTier } from '../utils/freshnessTier';
import { useNowSec } from '../utils/useNowSec';
import type { GtfsBundle } from '../buildtime/preprocessGtfs';

export function StopDetail() {
  const { stopId } = useParams<{ stopId: string }>();
  const { bundle, loading: bundleLoading, error: bundleError } = useGtfsBundle();

  if (!stopId) {
    return <MessageCard title="No stop ID" body="The URL is missing a stop ID." />;
  }

  if (bundleLoading) {
    return <MessageCard title="Loading schedule data..." body="One moment." />;
  }

  if (bundleError || !bundle) {
    return (
      <MessageCard
        title="Couldn't load schedule data"
        body={bundleError?.message ?? 'Unknown error.'}
      />
    );
  }

  return <StopDetailReady stopId={stopId} bundle={bundle} />;
}

function StopDetailReady({ stopId, bundle }: { stopId: string; bundle: GtfsBundle }) {
  const { status, rows, lastUpdated, isStale, error, refresh } = useArrivals(stopId, bundle);

  const stop = getStopMetadata(bundle, stopId);
  // Tick every 15s so the "Last updated …" text and any ETA countdowns
  // refresh visibly between data polls. Matches formatLastUpdated's
  // 15-second bucket size — anything faster would re-render without
  // visible change.
  const nowSec = useNowSec(15_000);

  const stopName = stop?.name ?? `Stop ${stopId}`;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label="Back to home" className="text-2xl text-primary">
          ←
        </Link>
        <h1 className="flex-1 text-xl font-bold">{stopName}</h1>
        <FavoriteStarButton stopId={stopId} stopName={stopName} />
      </header>

      {status === 'loading' && (
        <MessageCard title="Loading arrivals..." body="Fetching the latest from MARTA." />
      )}

      {status === 'error' && (
        <MessageCard
          title="Couldn't load arrivals"
          body={error?.message ?? 'Unknown error.'}
        />
      )}

      {status === 'success' && rows.length === 0 && (
        <MessageCard
          title="No upcoming buses"
          body="No more buses scheduled at this stop today. Check back tomorrow morning, or try a different stop."
        />
      )}

      {status === 'success' && rows.length > 0 && (
        <div className="space-y-6">
          {groupRowsByRoute(rows).map((group) => (
            <RouteSection key={`${group.routeId} ${group.headsign}`} group={group} bundle={bundle} nowSec={nowSec} />
          ))}
        </div>
      )}

      {(status === 'success' || status === 'error') && (
        <div className="flex items-center justify-between gap-3">
          <span>
            {lastUpdated !== null && (
              <LastUpdatedIndicator
                tier={freshnessTier({ lastUpdatedSec: lastUpdated, isStale, nowSec })}
                lastUpdated={lastUpdated}
                nowSec={nowSec}
              />
            )}
          </span>
          <RefreshButton onClick={refresh} />
        </div>
      )}
    </div>
  );
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="neutral" onClick={onClick} className="gap-1.5 px-3">
      <Icon name="refresh" />
      Refresh
    </Button>
  );
}

function RouteSection({
  group,
  bundle,
  nowSec,
}: {
  group: RouteGroup;
  bundle: GtfsBundle;
  nowSec: number;
}) {
  const route = getRouteMetadata(bundle, group.routeId);
  const shortName = route?.shortName ?? group.routeId;
  const level = assessDisruption(group.rows);
  const cancellations = group.rows.filter((r) => r.status === 'cancelled').length;
  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-fg">
          Route {shortName} — {group.headsign}
        </h2>
        <DisruptionBadge level={level} cancellations={cancellations} />
      </div>
      <ul className="mt-2 divide-y divide-divider">
        {group.rows.map((row) => {
          const props = toBusRowProps(row, nowSec);
          return <BusRow key={row.tripId} {...props} />;
        })}
      </ul>
    </section>
  );
}

const TIER_CLASS: Record<FreshnessTier, string> = {
  fresh: 'text-fg-muted',
  stale: 'text-status-warn',
  very_stale: 'text-status-cancelled',
};

const TIER_SUFFIX: Record<FreshnessTier, string> = {
  fresh: '',
  stale: ' — couldn’t refresh',
  very_stale: ' — data may be wrong',
};

function LastUpdatedIndicator({
  tier,
  lastUpdated,
  nowSec,
}: {
  tier: FreshnessTier;
  lastUpdated: number;
  nowSec: number;
}) {
  return (
    <p className={`text-xs ${TIER_CLASS[tier]}`} aria-live="polite">
      Last updated {formatLastUpdated(lastUpdated, nowSec)}
      {TIER_SUFFIX[tier]}
    </p>
  );
}

