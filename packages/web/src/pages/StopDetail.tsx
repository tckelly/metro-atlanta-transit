import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { TripUpdate } from '@atl-transit/gtfs';
import { Button, Icon, MessageCard, Skeleton } from '@atl-transit/components';

import { useArrivals } from '../features/stops/useArrivals';
import { useGtfsRepository } from '../services/gtfs/GtfsRepositoryContext';
import { useRealtimeFeed } from '../features/realtime/RealtimeFeedContext';
import { toBusRowProps } from '../features/stops/busRowMapper';
import { groupRowsByRoute, type RouteGroup } from '../features/stops/groupRowsByRoute';
import { useFormatTime } from '../i18n/formatters';
import {
  BusRowDisclosure,
  type DownstreamStopView,
} from '../features/stops/BusRowDisclosure';
import {
  downstreamStops,
  type TripStop,
} from '../features/stops/downstreamStops';
import { liveTripUpdateToTripStops } from '../features/stops/liveTripUpdateToTripStops';
import type { ClassifiedBusRow } from '../features/stops/busRowClassifier';
import type { GtfsRepository } from '../services/gtfs/GtfsRepository';
import { FavoriteStarButton } from '../features/favorites/FavoriteStarButton';
import { assessDisruption } from '../features/disruption/assessDisruption';
import { DisruptionBadge } from '../features/disruption/DisruptionBadge';
import { formatLastUpdated } from '../utils/formatLastUpdated';
import { freshnessTier, type FreshnessTier } from '../utils/freshnessTier';
import { todayServiceDate } from '../utils/serviceDate';
import { useNowSec } from '../utils/useNowSec';
import { usePullToRefresh } from '../features/pull-to-refresh/usePullToRefresh';
import { ARMED_THRESHOLD_PX, type PtrState } from '../features/pull-to-refresh/ptrReducer';
import { LastUpdatedAnnouncement } from '../features/stops/LastUpdatedAnnouncement';
import { RefreshAnnouncement } from '../features/stops/RefreshAnnouncement';

export function StopDetail() {
  const { t } = useTranslation();
  const { stopId } = useParams<{ stopId: string }>();

  if (!stopId) {
    return <MessageCard title={t('stopDetail.noStopIdTitle')} body={t('stopDetail.noStopIdBody')} />;
  }
  return <StopDetailReady stopId={stopId} />;
}

function StopDetailReady({ stopId }: { stopId: string }) {
  const { t } = useTranslation();
  const repo = useGtfsRepository();
  const { status, rows, lastUpdated, isStale, error, refresh } = useArrivals(stopId);
  const ptr = usePullToRefresh({ onRefresh: refresh });

  // Tracks button-initiated refreshes so the announcement can fire
  // for both PTR and button-click triggers. Auto-poll refreshes are
  // deliberately not tracked here — they don't deserve an SR
  // announcement (would fire twice a minute).
  const [buttonRefreshing, setButtonRefreshing] = useState(false);
  const handleManualRefresh = useCallback(async () => {
    setButtonRefreshing(true);
    try {
      await refresh();
    } finally {
      setButtonRefreshing(false);
    }
  }, [refresh]);
  const userInitiatedRefreshing = ptr.state.kind === 'refreshing' || buttonRefreshing;

  const stop = repo.getStop(stopId);
  // Tick every 15s so the "Last updated …" text and any ETA countdowns
  // refresh visibly between data polls. Matches formatLastUpdated's
  // 15-second bucket size — anything faster would re-render without
  // visible change.
  const nowSec = useNowSec(15_000);

  const stopName = stop?.name ?? `Stop ${stopId}`;
  const tier =
    lastUpdated !== null
      ? freshnessTier({ lastUpdatedSec: lastUpdated, isStale, nowSec })
      : null;

  return (
    <div
      className="relative space-y-4"
      onTouchStart={(e) => {
        const y = e.touches[0]?.clientY;
        if (y !== undefined) ptr.start(y);
      }}
      onTouchMove={(e) => {
        const y = e.touches[0]?.clientY;
        if (y !== undefined) ptr.move(y);
      }}
      onTouchEnd={ptr.end}
    >
      <PullIndicator state={ptr.state} />
      <RefreshAnnouncement active={userInitiatedRefreshing} />
      {tier !== null && <LastUpdatedAnnouncement tier={tier} />}
      <header className="flex items-center gap-3">
        <Link to="/" aria-label={t('stopDetail.backToHome')} className="text-2xl text-primary">
          ←
        </Link>
        <h1 className="flex-1 text-xl font-bold">{stopName}</h1>
        <FavoriteStarButton stopId={stopId} stopName={stopName} />
      </header>

      {status === 'loading' && <ArrivalsLoadingSkeleton />}

      {status === 'error' && (
        <ErrorCard error={error} />
      )}

      {status === 'success' && rows.length === 0 && (
        <MessageCard
          title={t('stopDetail.noUpcomingTitle')}
          body={t('stopDetail.noUpcomingBody')}
        />
      )}

      {status === 'success' && rows.length > 0 && (
        <div className="space-y-6">
          {groupRowsByRoute(rows).map((group) => (
            <RouteSection
              key={`${group.routeId} ${group.headsign}`}
              group={group}
              nowSec={nowSec}
            />
          ))}
        </div>
      )}

      {(status === 'success' || status === 'error') && (
        <div className="flex items-center justify-between gap-3">
          <span>
            {lastUpdated !== null && tier !== null && (
              <LastUpdatedIndicator
                tier={tier}
                lastUpdated={lastUpdated}
                nowSec={nowSec}
              />
            )}
          </span>
          <RefreshButton
            onClick={() => {
              void handleManualRefresh();
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton bars sized to match a real BusRow stack — same icon + two
 * lines of text. Wrapped in a polite live region so a screen reader
 * announces "Loading arrivals…" instead of the visual shimmer.
 */
function ArrivalsLoadingSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" aria-label={t('loading.arrivals')}>
      <span className="sr-only">{t('loading.arrivalsDots')}</span>
      <ul className="divide-y divide-divider">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3 py-3">
            <Skeleton className="mt-1 h-5 w-5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Visual pull-to-refresh indicator. Hidden when idle; otherwise floats
 * at the top of the scroll container and shows the gesture's state.
 * Resistance factor on translateY (0.4) makes the pull feel weighty —
 * 80px of finger travel renders as ~32px of indicator drop.
 */
function PullIndicator({ state }: { state: PtrState }) {
  const { t } = useTranslation();
  if (state.kind === 'idle') return null;
  const renderedDistance =
    state.kind === 'refreshing' ? ARMED_THRESHOLD_PX : state.distance;
  const label =
    state.kind === 'refreshing'
      ? t('stopDetail.ptrRefreshing')
      : state.kind === 'armed'
      ? t('stopDetail.ptrRelease')
      : t('stopDetail.ptrPull');
  // Purely visual — the SR-facing announcement comes from
  // `RefreshAnnouncement`, which fires for both PTR and button-
  // triggered refreshes and is silent during the pulling / armed
  // phases that don't need to interrupt a screen reader.
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-8 flex justify-center"
      style={{ transform: `translateY(${String(renderedDistance * 0.4)}px)` }}
    >
      <span className="rounded-full bg-surface-elevated px-3 py-1 text-xs text-fg-muted shadow">
        {label}
      </span>
    </div>
  );
}

/**
 * Generic error card for the stop view. The user sees a stable,
 * domain-meaningful message; technical detail (HTTP status, upstream
 * URL, etc.) goes to the console for developers — never to the DOM,
 * since this is a public site.
 */
function ErrorCard({ error }: { error: Error | null }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (error !== null) {
      console.error('StopDetail: arrivals failed to load', error);
    }
  }, [error]);
  return (
    <MessageCard
      title={t('stopDetail.loadErrorTitle')}
      body={t('stopDetail.loadErrorBody')}
    />
  );
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button variant="neutral" onClick={onClick} className="gap-1.5 px-3">
      <Icon name="refresh" />
      {t('stopDetail.refresh')}
    </Button>
  );
}

function RouteSection({ group, nowSec }: { group: RouteGroup; nowSec: number }) {
  const { t } = useTranslation();
  const repo = useGtfsRepository();
  const formatTime = useFormatTime();
  const feed = useRealtimeFeed();
  const route = repo.getRoute(group.routeId);
  const shortName = route?.shortName ?? group.routeId;
  const level = assessDisruption(group.rows);
  const cancellations = group.rows.filter((r) => r.status === 'cancelled').length;

  // One-shot index of the realtime feed by tripId so each row's
  // disclosure can pull its live downstream pattern without scanning
  // the full updates list per render.
  const tripUpdatesByTripId = useMemo(
    () => new Map(feed.tripUpdates.map((u) => [u.tripId, u])),
    [feed.tripUpdates],
  );

  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-fg">
          {t('stopDetail.routeHeader', { shortName, headsign: group.headsign })}
        </h2>
        <DisruptionBadge level={level} cancellations={cancellations} />
      </div>
      <ul className="mt-2 divide-y divide-divider">
        {group.rows.map((row) => (
          <DisclosureBusRow
            key={row.tripId}
            row={row}
            nowSec={nowSec}
            shortName={shortName}
            tripUpdate={tripUpdatesByTripId.get(row.tripId)}
            repo={repo}
            t={t}
            formatTime={formatTime}
          />
        ))}
      </ul>
    </section>
  );
}

interface DisclosureBusRowProps {
  row: ClassifiedBusRow;
  nowSec: number;
  shortName: string;
  tripUpdate: TripUpdate | undefined;
  repo: GtfsRepository;
  t: TFunction;
  formatTime: (unixSec: number) => string;
}

/**
 * Per-row glue between a `ClassifiedBusRow` and `BusRowDisclosure`.
 *
 * - Live rows (rt trip update present) derive their downstream stops
 *   in-memory — no network call, and free SKIPPED flags + predicted
 *   ETAs come along for the ride.
 * - Scheduled / no-live / cancelled rows lazy-fetch the trip's stop
 *   pattern from the backend on first open, then cache the result in
 *   component state so re-opens don't re-fetch.
 *
 * Per-row component (instead of an array of state in the parent) so
 * each row owns its own open + fetched cache; no cross-row coupling.
 */
function DisclosureBusRow({
  row,
  nowSec,
  shortName,
  tripUpdate,
  repo,
  t,
  formatTime,
}: DisclosureBusRowProps) {
  const busRowProps = toBusRowProps(row, nowSec, { t, formatTime });

  // Live path: derive downstream from the realtime trip update.
  const liveDownstream = useMemo<TripStop[] | undefined>(() => {
    if (row.status !== 'live' || tripUpdate === undefined) return undefined;
    return downstreamStops(
      liveTripUpdateToTripStops(tripUpdate),
      row.stopSequence,
    );
  }, [row.status, row.stopSequence, tripUpdate]);

  // Scheduled path: cache for the lazy fetch + a separate error flag so
  // a fetch failure renders as an explicit error message instead of
  // masquerading as a (success-looking) empty downstream list.
  const [scheduledDownstream, setScheduledDownstream] = useState<
    TripStop[] | undefined
  >(undefined);
  const [fetchStarted, setFetchStarted] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  const handleOpen = useCallback(() => {
    if (liveDownstream !== undefined) return;
    if (fetchStarted) return;
    setFetchStarted(true);
    repo
      .getStopsForTrip(row.tripId, todayServiceDate())
      .then((stops) => {
        setScheduledDownstream(downstreamStops(stops, row.stopSequence));
      })
      .catch((err: unknown) => {
        // Surface a rider-facing error label; keep technical detail in
        // the console for developers (never in the DOM on a public site).
        console.error('DisclosureBusRow: getStopsForTrip failed', err);
        setFetchFailed(true);
      });
  }, [liveDownstream, fetchStarted, repo, row.tripId, row.stopSequence]);

  const sourceDownstream = liveDownstream ?? scheduledDownstream;
  const downstreamView = useMemo<DownstreamStopView[] | undefined>(() => {
    if (sourceDownstream === undefined) return undefined;
    return sourceDownstream.map((s) => {
      const stop = repo.getStop(s.stopId);
      const view: DownstreamStopView = {
        stopId: s.stopId,
        name: stop?.name ?? s.stopId,
      };
      if (s.isSkipped === true) view.isSkipped = true;
      // Live predictions take precedence; scheduled is the fallback
      // so scheduled / no_live / cancelled rows show clock times too.
      const arrivalTime = s.predictedArrivalTime ?? s.scheduledTime;
      if (arrivalTime !== undefined) {
        view.arrivalText = formatTime(arrivalTime);
      }
      return view;
    });
  }, [sourceDownstream, repo, formatTime]);

  const time = formatTime(row.scheduledTime);
  const labelArgs = { shortName, headsign: row.headsign, time };

  return (
    <BusRowDisclosure
      busRowProps={busRowProps}
      downstream={downstreamView}
      onOpen={handleOpen}
      triggerLabel={t('stopDetail.disclosureTrigger', labelArgs)}
      panelLabel={t('stopDetail.disclosurePanel', labelArgs)}
      loadingLabel={t('stopDetail.disclosureLoading')}
      lastStopLabel={t('stopDetail.disclosureLastStop')}
      skippedLabel={t('stopDetail.disclosureSkipped')}
      {...(fetchFailed ? { errorMessage: t('stopDetail.disclosureLoadError') } : {})}
    />
  );
}

const TIER_CLASS: Record<FreshnessTier, string> = {
  fresh: 'text-fg-muted',
  stale: 'text-status-warn',
  very_stale: 'text-status-cancelled',
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
  const { t } = useTranslation();
  const suffix =
    tier === 'stale'
      ? t('stopDetail.lastUpdatedStaleSuffix')
      : tier === 'very_stale'
      ? t('stopDetail.lastUpdatedVeryStaleSuffix')
      : '';
  // Visual-only. The SR layer is owned by `LastUpdatedAnnouncement`,
  // which fires only on tier transitions (fresh ↔ stale ↔ very_stale)
  // instead of on every 15-second text-bucket flip.
  return (
    <p className={`text-xs ${TIER_CLASS[tier]}`}>
      {t('stopDetail.lastUpdatedPrefix')} {formatLastUpdated(lastUpdated, nowSec, t)}
      {suffix}
    </p>
  );
}
