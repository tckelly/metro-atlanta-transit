import { describe, it, expect } from 'vitest';

import { formatEta, formatDelay, type ArrivalFormatters } from './arrivalFormat';
import { i18next } from '../i18n/init';
import { formatTime } from '../i18n/formatters';

// Fixed reference time: 2026-05-22 12:00 EDT. Matches the busRowMapper suite.
const NOW_SEC = 1779465600;

const FORMATTERS: ArrivalFormatters = {
  t: i18next.t.bind(i18next),
  formatTime: (unixSec) =>
    formatTime(unixSec, { locale: 'en', hour12: false, timeZone: 'America/New_York' }),
};

describe('formatEta', () => {
  it('shows "Arriving" when under a minute away', () => {
    expect(formatEta(NOW_SEC + 45, NOW_SEC, FORMATTERS)).toBe('Arriving');
  });

  it('rounds to "X min" within the hour', () => {
    expect(formatEta(NOW_SEC + 180, NOW_SEC, FORMATTERS)).toBe('3 min');
  });

  it('still shows minutes just under 60 minutes out', () => {
    expect(formatEta(NOW_SEC + 59 * 60, NOW_SEC, FORMATTERS)).toBe('59 min');
  });

  it('switches to a clock time at/beyond 60 minutes', () => {
    expect(formatEta(NOW_SEC + 98 * 60, NOW_SEC, FORMATTERS)).toBe('13:38');
  });
});

describe('formatDelay', () => {
  const t = i18next.t.bind(i18next);

  it('returns undefined for sub-minute deviations (noise)', () => {
    expect(formatDelay(30, t)).toBeUndefined();
    expect(formatDelay(-30, t)).toBeUndefined();
  });

  it('labels "late" when behind schedule', () => {
    expect(formatDelay(240, t)).toMatch(/4 min late/);
  });

  it('labels "early" when ahead of schedule', () => {
    expect(formatDelay(-120, t)).toMatch(/2 min early/);
  });
});
