/**
 * Visual indicator that a route at a stop has recent cancellations.
 *
 * Rendered next to the route header in StopDetail. The `role="status"`
 * with a descriptive `aria-label` lets screen readers announce the
 * disruption alongside the route name without forcing the visual label
 * to spell out the level (the color + count carries that for sighted
 * users).
 */
import { useTranslation } from 'react-i18next';
import { Badge } from '@atl-transit/components';

import type { DisruptionLevel } from './thresholds';

export interface DisruptionBadgeProps {
  level: DisruptionLevel;
  cancellations: number;
}

export function DisruptionBadge({ level, cancellations }: DisruptionBadgeProps) {
  const { t } = useTranslation();
  if (level === 'none') return null;

  const severity = level === 'strong' ? 'danger' : 'warning';
  const text = t('disruption.badge', { count: cancellations });
  const ariaLabel =
    level === 'strong'
      ? t('disruption.ariaStrong', { count: cancellations })
      : t('disruption.ariaSoft', { count: cancellations });

  return (
    <span role="status" aria-label={ariaLabel}>
      <Badge severity={severity}>{text}</Badge>
    </span>
  );
}
