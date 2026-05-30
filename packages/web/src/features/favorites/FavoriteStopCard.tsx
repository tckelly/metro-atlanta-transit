/**
 * Compact home-screen tile for a single favorited stop. With the
 * shared realtime feed (RealtimeFeedProvider) in place, all favorite
 * cards on Home consume one polling cycle — the previous "N favorites
 * → N fetches" cost is gone.
 *
 * Two render modes:
 *
 * - `browse` (default): the entire card is a `<Link>` to the stop
 *   detail page; the right slot shows a passive `›` chevron.
 *
 * - `reorder`: the card stops being a link (no navigation), and the
 *   right slot swaps to a vertical `↑`/`↓` button pair. The card's
 *   outer dimensions stay identical between modes — same border, same
 *   arrival preview, same fixed-width right slot — so toggling reorder
 *   mode never reflows the list, only swaps the right-slot affordance.
 *
 * The parent (Home) drives reorder mode: it owns the toggle, computes
 * `canMoveUp` / `canMoveDown` from the list position, and handles the
 * sr-only live-region announcement after `onMove` fires.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Skeleton } from '@atl-transit/components';

import { useArrivals } from '../stops/useArrivals';
import { toBusRowProps } from '../stops/busRowMapper';
import { useGtfsRepository } from '../../services/gtfs/GtfsRepositoryContext';
import { useFormatTime } from '../../i18n/formatters';
import { useNowSec } from '../../utils/useNowSec';
import type { MoveDirection } from './reorder';

const PREVIEW_COUNT = 2;

export type FavoriteStopCardMode = 'browse' | 'reorder';

export interface FavoriteStopCardProps {
  stopId: string;
  mode?: FavoriteStopCardMode;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (direction: MoveDirection) => void;
}

const WRAPPER_CLASS =
  'block rounded border border-divider bg-surface-elevated transition-colors';
const BROWSE_HOVER = 'hover:border-primary';

export function FavoriteStopCard({
  stopId,
  mode = 'browse',
  canMoveUp = false,
  canMoveDown = false,
  onMove,
}: FavoriteStopCardProps) {
  const { t } = useTranslation();
  const repo = useGtfsRepository();
  const formatTime = useFormatTime();
  const { status, rows } = useArrivals(stopId);
  const nowSec = useNowSec(15_000);
  const stop = repo.getStop(stopId);
  const stopName = stop?.name ?? `Stop ${stopId}`;
  const preview = rows.slice(0, PREVIEW_COUNT);

  const body = (
    <div className="flex">
      <div className="min-w-0 flex-1 p-4">
        <div className="font-semibold">{stopName}</div>
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
      </div>
      <RightSlot
        mode={mode}
        stopName={stopName}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMove={onMove}
      />
    </div>
  );

  if (mode === 'reorder') {
    return <div className={WRAPPER_CLASS}>{body}</div>;
  }
  return (
    <Link to={`/stop/${stopId}`} className={`${WRAPPER_CLASS} ${BROWSE_HOVER}`}>
      {body}
    </Link>
  );
}

interface RightSlotProps {
  mode: FavoriteStopCardMode;
  stopName: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: ((direction: MoveDirection) => void) | undefined;
}

/**
 * The reserved 44px-wide column on the card's right edge. Holds the
 * navigation chevron in browse mode and the move-button pair in reorder
 * mode. Fixed width either way so the main content area never reflows
 * when the mode toggles.
 */
function RightSlot({ mode, stopName, canMoveUp, canMoveDown, onMove }: RightSlotProps) {
  const { t } = useTranslation();

  if (mode === 'browse') {
    return (
      <div className="flex w-11 shrink-0 items-center justify-center">
        <span aria-hidden="true" className="text-fg-muted">
          ›
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-11 shrink-0 flex-col items-center justify-center">
      <Button
        variant="icon"
        aria-label={t('favorites.ariaMoveUp', { stopName })}
        disabled={!canMoveUp}
        onClick={() => onMove?.('up')}
      >
        <Icon name="chevron-up" />
      </Button>
      <Button
        variant="icon"
        aria-label={t('favorites.ariaMoveDown', { stopName })}
        disabled={!canMoveDown}
        onClick={() => onMove?.('down')}
      >
        <Icon name="chevron-down" />
      </Button>
    </div>
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
