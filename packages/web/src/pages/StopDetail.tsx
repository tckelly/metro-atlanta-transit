import { Link, useParams } from 'react-router-dom';
import { BusRow } from '@atl-transit/components';

import { useArrivals } from '../features/stops/useArrivals';
import { useGtfsBundle } from '../services/useGtfsBundle';
import { toBusRowProps } from '../features/stops/busRowMapper';
import { getStopMetadata } from '../services/gtfsStatic';
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
  const { status, rows, lastUpdated, isStale, error } = useArrivals(stopId, bundle);

  const stop = getStopMetadata(bundle, stopId);
  const nowSec = Math.floor(Date.now() / 1000);

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
        <ul className="divide-y divide-divider">
          {rows.map((row) => {
            const props = toBusRowProps(row, nowSec);
            return <BusRow key={row.tripId} {...props} />;
          })}
        </ul>
      )}

      {lastUpdated !== null && (
        <p className="text-xs text-fg-muted" aria-live="polite">
          {isStale ? 'Couldn’t refresh — ' : ''}
          Last updated {formatLastUpdated(lastUpdated, nowSec)}
        </p>
      )}
    </div>
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

function formatLastUpdated(lastUpdatedSec: number, nowSec: number): string {
  const ageSec = Math.max(0, nowSec - lastUpdatedSec);
  if (ageSec < 60) return `${ageSec} sec ago`;
  const minutes = Math.round(ageSec / 60);
  return `${minutes} min ago`;
}
