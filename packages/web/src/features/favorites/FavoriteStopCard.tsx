/**
 * Compact home-screen tile for a single favorited stop.
 *
 * Each card runs its own arrivals hook so the next 1–2 buses stay live
 * while the user is on the home screen. The polling cost grows linearly
 * with favorites; that is acceptable at the MAX_FAVORITES cap. A shared
 * realtime cache (M1 done-criteria carry-over) is the right fix when the
 * cost shows up.
 */
import { Link } from 'react-router-dom';

import { useArrivals } from '../stops/useArrivals';
import { toBusRowProps } from '../stops/busRowMapper';
import { getRouteMetadata, getStopMetadata } from '../../services/gtfsStatic';
import { useNowSec } from '../../utils/useNowSec';
import type { GtfsBundle } from '../../buildtime/preprocessGtfs';

const PREVIEW_COUNT = 2;

export interface FavoriteStopCardProps {
  stopId: string;
  bundle: GtfsBundle;
}

export function FavoriteStopCard({ stopId, bundle }: FavoriteStopCardProps) {
  const { status, rows } = useArrivals(stopId, bundle);
  const nowSec = useNowSec(15_000);
  const stop = getStopMetadata(bundle, stopId);
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
        {status === 'loading' && <span className="text-fg-muted">Loading arrivals…</span>}
        {status === 'error' && (
          <span className="text-status-cancelled">Couldn’t load arrivals</span>
        )}
        {status === 'success' && preview.length === 0 && (
          <span className="text-fg-muted">No upcoming buses</span>
        )}
        {status === 'success' && preview.length > 0 && (
          <ul className="space-y-1">
            {preview.map((row) => {
              const route = getRouteMetadata(bundle, row.routeId);
              const shortName = route?.shortName ?? row.routeId;
              const props = toBusRowProps(row, nowSec);
              return (
                <li key={row.tripId} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-fg">
                    Route {shortName} → {row.headsign}
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
