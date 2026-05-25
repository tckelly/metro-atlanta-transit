/**
 * Locale-aware formatters that combine the active i18n locale with
 * user-prefs from SettingsContext.
 *
 * Two shapes for each formatter:
 *  - A pure function (`formatTime`) — takes everything as parameters.
 *    Trivially testable; used by other utility modules that don't
 *    have React context access.
 *  - A hook (`useFormatTime`) — reads locale + clockFormat, returns a
 *    memoized callable. Stable reference across renders unless the
 *    inputs change, so consumers can put it in `useMemo` dep arrays
 *    without breaking memoization.
 *
 * The hook resolves `clockFormat = 'auto'` by passing
 * `hour12: undefined` to `Intl.DateTimeFormat`, which then picks the
 * locale's default (en-US → 12h, es → 24h, etc.).
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useSettings } from '../features/settings/SettingsContext';

const ATLANTA_TIMEZONE = 'America/New_York';

export interface FormatTimeOptions {
  locale: string;
  /** When omitted, the locale's default applies. */
  hour12?: boolean;
  /** IANA timezone. Defaults to MARTA's home timezone. */
  timeZone?: string;
}

export function formatTime(unixSec: number, opts: FormatTimeOptions): string {
  const intlOpts: Intl.DateTimeFormatOptions = {
    timeZone: opts.timeZone ?? ATLANTA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  };
  if (opts.hour12 !== undefined) intlOpts.hour12 = opts.hour12;
  const fmt = new Intl.DateTimeFormat(opts.locale, intlOpts);
  return fmt.format(new Date(unixSec * 1000));
}

export function useFormatTime(): (unixSec: number) => string {
  const { i18n } = useTranslation();
  const { clockFormat } = useSettings();

  return useMemo(() => {
    const hour12 = clockFormat === '12h' ? true : clockFormat === '24h' ? false : undefined;
    const intlOpts: Intl.DateTimeFormatOptions = {
      timeZone: ATLANTA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
    };
    if (hour12 !== undefined) intlOpts.hour12 = hour12;
    const fmt = new Intl.DateTimeFormat(i18n.language, intlOpts);
    return (unixSec: number) => fmt.format(new Date(unixSec * 1000));
  }, [i18n.language, clockFormat]);
}
