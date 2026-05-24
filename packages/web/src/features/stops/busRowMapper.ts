import type { BusRowProps } from '@atl-transit/components';
import type { OccupancyStatus } from '@atl-transit/gtfs';

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

function formatEta(predictedSec: number, nowSec: number): string {
  const deltaSec = predictedSec - nowSec;
  if (deltaSec < ARRIVING_THRESHOLD_SEC) return 'Arriving';
  const minutes = Math.round(deltaSec / 60);
  if (minutes >= LONG_ETA_THRESHOLD_MIN) return formatScheduledTime(predictedSec);
  return `${minutes} min`;
}

function formatScheduledTime(unixSec: number): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return fmt.format(new Date(unixSec * 1000));
}

function formatDelay(delaySec: number): string | undefined {
  if (Math.abs(delaySec) < SECONDARY_DELAY_THRESHOLD_SEC) return undefined;
  const minutes = Math.round(Math.abs(delaySec) / 60);
  return delaySec > 0 ? `${minutes} min late` : `${minutes} min early`;
}

/**
 * Translate a GTFS-RT OccupancyStatus into the passenger-facing label per
 * docs/ux-guidelines.md. Returns undefined for values we don't surface
 * (NO_DATA_AVAILABLE, NOT_BOARDABLE) so callers can omit the segment.
 */
function occupancyLabel(status: OccupancyStatus | undefined): string | undefined {
  switch (status) {
    case 'EMPTY':
    case 'MANY_SEATS_AVAILABLE':
      return 'Seats available';
    case 'FEW_SEATS_AVAILABLE':
      return 'Filling up';
    case 'STANDING_ROOM_ONLY':
      return 'Standing room only';
    case 'CRUSHED_STANDING_ROOM_ONLY':
    case 'FULL':
      return 'Very crowded';
    case 'NOT_ACCEPTING_PASSENGERS':
      return 'Not accepting riders';
    case 'NO_DATA_AVAILABLE':
    case 'NOT_BOARDABLE':
    case undefined:
      return undefined;
  }
}

export function toBusRowProps(row: ClassifiedBusRow, nowSec: number): BusRowProps {
  const scheduledStr = formatScheduledTime(row.scheduledTime);

  if (row.status === 'cancelled') {
    return {
      primaryText: 'Cancelled',
      primaryStyle: 'strikethrough',
      secondaryText: `Scheduled ${scheduledStr}`,
      severity: 'danger',
      icon: 'warning',
    };
  }

  if (row.status === 'no_live_data') {
    return {
      primaryText: scheduledStr,
      secondaryText: 'Scheduled · No live data',
      severity: 'neutral',
      icon: 'clock',
    };
  }

  // status === 'live'
  const predictedSec = row.predictedTime ?? row.scheduledTime;
  const delaySec = row.delaySec ?? 0;
  const isDelayed = delaySec > DELAYED_THRESHOLD_SEC;

  const delayLabel = formatDelay(delaySec);
  const occupancyText = occupancyLabel(row.occupancy);
  const secondaryText = [`Scheduled ${scheduledStr}`, delayLabel, occupancyText]
    .filter((part): part is string => part !== undefined)
    .join(' · ');

  return {
    primaryText: formatEta(predictedSec, nowSec),
    secondaryText,
    severity: isDelayed ? 'warning' : 'success',
    icon: 'clock',
  };
}
