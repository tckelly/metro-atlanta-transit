/**
 * Convert a straight-line distance in meters to an estimated walking
 * time in whole minutes.
 *
 * Uses a deliberately conservative 80 m/min (≈4.8 km/h) pace and rounds
 * up: when a commuter is deciding whether to catch a bus, arriving
 * early beats arriving late. Straight-line distance under-estimates
 * real walking distance, which biases the same direction.
 *
 * The labeled formatter routes through `t` so the label respects the
 * active locale (en/es), including pluralization.
 */
import type { TFunction } from 'i18next';

const METERS_PER_MINUTE = 80;

export function walkingMinutes(meters: number): number {
  // Below one full minute (including negatives) we return 0 so the
  // formatter can render "<1 min walk" — claiming "0 min walk" reads
  // wrong, and "1 min walk" overstates a 15-second stroll.
  if (meters < METERS_PER_MINUTE) return 0;
  return Math.ceil(meters / METERS_PER_MINUTE);
}

export function formatWalkingMinutes(meters: number, t: TFunction): string {
  const minutes = walkingMinutes(meters);
  if (minutes < 1) return t('walking.under1Min');
  return t('walking.minutes', { count: minutes });
}
