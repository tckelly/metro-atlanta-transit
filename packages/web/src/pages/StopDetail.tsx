import { Link, useParams } from 'react-router-dom';
import { BusRow, Icon } from '@atl-transit/components';

import { useArrivals } from '../features/stops/useArrivals';
import { useGtfsBundle } from '../services/useGtfsBundle';
import { toBusRowProps } from '../features/stops/busRowMapper';
import { groupRowsByRoute, type RouteGroup } from '../features/stops/groupRowsByRoute';
import { getRouteMetadata, getStopMetadata } from '../services/gtfsStatic';
import { formatLastUpdated } from '../utils/formatLastUpdated';
import { freshnessTier, type FreshnessTier } from '../utils/freshnessTier';
import { useNowSec } from '../utils/useNowSec';
import type { GtfsBundle } from '../buildtime/preprocessGtfs';

export function StopDetail() {
  const { stopId } = useParams<{ stopId: string }>();
  const { bundle, loading: bundleLoading, error: bundleError } = useGtfsBundle();

  if (!stopId) {
    return <Message title="No stop ID" body="The URL is missing a stop ID." />;
  }

  if (bundleLoading) {
    return <Message title="Loading schedule data..." body="One moment." />;
  }

  if (bundleError || !bundle) {
    return (
      <Message
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
  // refresh visibly between data polls.
  const nowSec = useNowSec(15_000);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label="Back to home" className="text-2xl text-primary">
          ←
        </Link>
        <h1 className="text-xl font-bold">{stop?.name ?? `Stop ${stopId}`}</h1>
      </header>

      {status === 'loading' && (
        <Message title="Loading arrivals..." body="Fetching the latest from MARTA." />
      )}

      {status === 'error' && (
        <Message
          title="Couldn't load arrivals"
          body={error?.message ?? 'Unknown error.'}
        />
      )}

      {status === 'success' && rows.length === 0 && (
        <Message
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
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-divider px-3 text-sm font-medium text-fg hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Icon name="refresh" />
      Refresh
    </button>
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
  return (
    <section>
      <h2 className="text-base font-semibold text-fg">
        Route {shortName} — {group.headsign}
      </h2>
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

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-divider bg-surface-elevated p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-fg-muted">{body}</p>
    </div>
  );
}

