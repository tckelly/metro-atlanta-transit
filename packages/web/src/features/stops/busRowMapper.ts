import type { BusRowProps } from '@atl-transit/components';
import type { OccupancyStatus } from '@atl-transit/gtfs';
import type { TFunction } from 'i18next';

import type { ClassifiedBusRow } from './busRowClassifier';

/**
 * Translate a domain-level ClassifiedBusRow into the visual-semantic
 * BusRowProps that the components library expects. Per ADR-0003, the
 * components package knows nothing about MARTA — the mapping happens here.
 *
 * Inputs:
 * - `row`: classified bus row from `busRowClassifier.ts`
 * - `nowSec`: current Unix seconds, passed explicitly so tests are
 *   deterministic and the function is pure.
 * - `formatters.t`: i18n translator. Strings come from `en.json` (and
 *   eventually `es.json`); callers pass it down so this module stays
 *   pure / synchronous.
 * - `formatters.formatTime`: bound clock formatter that knows the
 *   active locale + the user's 12h/24h preference. The caller
 *   typically gets it from `useFormatTime()`.
 */

const DELAYED_THRESHOLD_SEC = 180;
const ARRIVING_THRESHOLD_SEC = 60;
const SECONDARY_DELAY_THRESHOLD_SEC = 60;
/**
 * When the ETA exceeds this many minutes, switch the primary line from
 * a countdown ("98 min") to the clock time ("06:04"). Large minute
 * counts are visually quirky in 32px bold and the user is no longer
 * thinking in countdown terms at that range anyway.
 */
const LONG_ETA_THRESHOLD_MIN = 60;

export interface BusRowMapperFormatters {
  t: TFunction;
  formatTime: (unixSec: number) => string;
}

function formatEta(
  predictedSec: number,
  nowSec: number,
  formatters: BusRowMapperFormatters,
): string {
  const deltaSec = predictedSec - nowSec;
  if (deltaSec < ARRIVING_THRESHOLD_SEC) return formatters.t('eta.arriving');
  const minutes = Math.round(deltaSec / 60);
  if (minutes >= LONG_ETA_THRESHOLD_MIN) return formatters.formatTime(predictedSec);
  return formatters.t('eta.minutes', { count: minutes });
}

function formatDelay(
  delaySec: number,
  t: TFunction,
): string | undefined {
  if (Math.abs(delaySec) < SECONDARY_DELAY_THRESHOLD_SEC) return undefined;
  const minutes = Math.round(Math.abs(delaySec) / 60);
  return delaySec > 0
    ? t('eta.delayLate', { count: minutes })
    : t('eta.delayEarly', { count: minutes });
}

/**
 * Translate a GTFS-RT OccupancyStatus into the passenger-facing label per
 * docs/ux-guidelines.md. Returns undefined for values we don't surface
 * (NO_DATA_AVAILABLE, NOT_BOARDABLE) so callers can omit the segment.
 */
function occupancyLabel(
  status: OccupancyStatus | undefined,
  t: TFunction,
): string | undefined {
  switch (status) {
    case 'EMPTY':
    case 'MANY_SEATS_AVAILABLE':
      return t('occupancy.seatsAvailable');
    case 'FEW_SEATS_AVAILABLE':
      return t('occupancy.fillingUp');
    case 'STANDING_ROOM_ONLY':
      return t('occupancy.standingRoomOnly');
    case 'CRUSHED_STANDING_ROOM_ONLY':
    case 'FULL':
      return t('occupancy.veryCrowded');
    case 'NOT_ACCEPTING_PASSENGERS':
      return t('occupancy.notAccepting');
    case 'NO_DATA_AVAILABLE':
    case 'NOT_BOARDABLE':
    case undefined:
      return undefined;
  }
}

export function toBusRowProps(
  row: ClassifiedBusRow,
  nowSec: number,
  formatters: BusRowMapperFormatters,
): BusRowProps {
  const { t, formatTime } = formatters;
  const scheduledStr = formatTime(row.scheduledTime);

  if (row.status === 'cancelled') {
    return {
      primaryText: t('eta.cancelled'),
      primaryStyle: 'strikethrough',
      secondaryText: t('eta.scheduled', { time: scheduledStr }),
      severity: 'danger',
      icon: 'warning',
    };
  }

  if (row.status === 'no_live_data') {
    return {
      primaryText: scheduledStr,
      secondaryText: t('eta.noLiveData'),
      severity: 'neutral',
      icon: 'clock',
    };
  }

  // status === 'live'
  const predictedSec = row.predictedTime ?? row.scheduledTime;
  const delaySec = row.delaySec ?? 0;
  const isDelayed = delaySec > DELAYED_THRESHOLD_SEC;

  const delayLabel = formatDelay(delaySec, t);
  const occupancyText = occupancyLabel(row.occupancy, t);
  const secondaryText = [
    t('eta.scheduled', { time: scheduledStr }),
    delayLabel,
    occupancyText,
  ]
    .filter((part): part is string => part !== undefined)
    .join(' · ');

  return {
    primaryText: formatEta(predictedSec, nowSec, formatters),
    secondaryText,
    severity: isDelayed ? 'warning' : 'success',
    icon: 'clock',
  };
}
