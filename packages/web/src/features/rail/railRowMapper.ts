import type { ArrivalRowProps } from '@atl-transit/components';

import type { RailArrivalDTO } from '../../services/martaRail';
import {
  formatEta,
  formatDelay,
  DELAYED_THRESHOLD_SEC,
  type ArrivalFormatters,
} from '../../utils/arrivalFormat';

/**
 * Translate a domain-level {@link RailArrivalDTO} into the visual-semantic
 * {@link ArrivalRowProps} the components library expects. Per ADR-0003, the
 * components package knows nothing about MARTA — the mapping happens here.
 *
 * Rail's status model is simpler than bus (see `docs/features/rail.md`): the
 * feed carries no cancellation, no occupancy, and no downstream stops, so a row
 * is either **live** (`isRealtime`) or **scheduled**. Both show the ETA
 * countdown (via the shared `formatEta`); a scheduled row is distinguished by
 * `neutral` severity and a "Scheduled" label rather than a clock-only time,
 * honoring rail's frequency-based UX. Delay severity reuses the shared
 * `DELAYED_THRESHOLD_SEC` so "late" reads identically across bus and rail.
 *
 * @param nowSec Current Unix seconds, passed explicitly so the function is pure.
 */
export function toRailRowProps(
  dto: RailArrivalDTO,
  nowSec: number,
  formatters: ArrivalFormatters,
): ArrivalRowProps {
  const { t } = formatters;
  const primaryText = formatEta(dto.arrivalTime, nowSec, formatters);

  if (!dto.isRealtime) {
    return {
      primaryText,
      secondaryText: t('rail.scheduled'),
      severity: 'neutral',
      icon: 'clock',
    };
  }

  const delaySec = dto.delaySeconds ?? 0;
  const isDelayed = delaySec > DELAYED_THRESHOLD_SEC;
  const delayLabel = formatDelay(delaySec, t);

  return {
    primaryText,
    ...(delayLabel !== undefined ? { secondaryText: delayLabel } : {}),
    severity: isDelayed ? 'warning' : 'success',
    icon: 'clock',
  };
}
