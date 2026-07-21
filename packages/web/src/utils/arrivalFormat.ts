/**
 * Shared arrival-time formatting for the transit row mappers.
 *
 * These pure helpers turn an absolute predicted arrival (Unix seconds) and a
 * schedule deviation into the rider-facing ETA string and delay label. They
 * live here — rather than inside a mode-specific mapper — because both the bus
 * mapper (`busRowMapper.ts`) and the rail mapper consume them, so bus and rail
 * ETAs render through identical logic. Promoted out of `busRowMapper` when rail
 * became the second consumer (CLAUDE.md: promote on the second consumer).
 */
import type { TFunction } from 'i18next';

/** Under this many seconds to arrival, show "Arriving" instead of a countdown. */
export const ARRIVING_THRESHOLD_SEC = 60;
/**
 * At/beyond this many minutes to arrival, switch the primary line from a
 * countdown ("98 min") to a clock time ("06:04"). Large minute counts read
 * awkwardly in big bold type and the rider is no longer thinking in countdown
 * terms at that range.
 */
export const LONG_ETA_THRESHOLD_MIN = 60;
/** Below this absolute delay, don't surface a delay label — sub-minute is noise. */
export const SECONDARY_DELAY_THRESHOLD_SEC = 60;
/** Above this lateness, a live arrival is styled as running behind (warning severity). */
export const DELAYED_THRESHOLD_SEC = 180;

export interface ArrivalFormatters {
  /** i18n translator. Callers pass it down so this module stays pure/synchronous. */
  t: TFunction;
  /** Locale- and 12h/24h-aware clock formatter, typically from `useFormatTime()`. */
  formatTime: (unixSec: number) => string;
}

/**
 * Format an absolute predicted arrival as a rider-facing ETA: "Arriving" when
 * imminent, "X min" within the hour, or a clock time beyond {@link LONG_ETA_THRESHOLD_MIN}.
 */
export function formatEta(
  predictedSec: number,
  nowSec: number,
  formatters: ArrivalFormatters,
): string {
  const deltaSec = predictedSec - nowSec;
  if (deltaSec < ARRIVING_THRESHOLD_SEC) return formatters.t('eta.arriving');
  const minutes = Math.round(deltaSec / 60);
  if (minutes >= LONG_ETA_THRESHOLD_MIN) return formatters.formatTime(predictedSec);
  return formatters.t('eta.minutes', { count: minutes });
}

/**
 * Format a schedule deviation as "X min late" / "X min early", or `undefined`
 * when the deviation is under {@link SECONDARY_DELAY_THRESHOLD_SEC} (not worth showing).
 *
 * @param delaySec Signed seconds: positive = behind schedule, negative = ahead.
 */
export function formatDelay(delaySec: number, t: TFunction): string | undefined {
  if (Math.abs(delaySec) < SECONDARY_DELAY_THRESHOLD_SEC) return undefined;
  const minutes = Math.round(Math.abs(delaySec) / 60);
  return delaySec > 0
    ? t('eta.delayLate', { count: minutes })
    : t('eta.delayEarly', { count: minutes });
}
