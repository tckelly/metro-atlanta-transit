import { describe, it, expect } from 'vitest';

import { toRailRowProps } from './railRowMapper';
import type { RailArrivalDTO } from '../../services/martaRail';
import { i18next } from '../../i18n/init';
import { formatTime } from '../../i18n/formatters';
import type { ArrivalFormatters } from '../../utils/arrivalFormat';

// Fixed reference time: 2026-05-22 12:00 EDT. Matches the bus mapper suite.
const NOW_SEC = 1779465600;

const FORMATTERS: ArrivalFormatters = {
  t: i18next.t.bind(i18next),
  formatTime: (unixSec) =>
    formatTime(unixSec, { locale: 'en', hour12: false, timeZone: 'America/New_York' }),
};

function liveArrival(overrides: Partial<RailArrivalDTO> = {}): RailArrivalDTO {
  return {
    station: 'FIVE POINTS STATION',
    line: 'RED',
    direction: 'N',
    destination: 'North Springs',
    trainId: '402',
    arrivalTime: NOW_SEC + 240, // 4 min out
    isRealtime: true,
    delaySeconds: 0,
    ...overrides,
  };
}

describe('toRailRowProps — live', () => {
  it('shows the ETA countdown with success severity and a clock icon', () => {
    const props = toRailRowProps(liveArrival(), NOW_SEC, FORMATTERS);
    expect(props.primaryText).toBe('4 min');
    expect(props.severity).toBe('success');
    expect(props.icon).toBe('clock');
  });

  it('shows "Arriving" when under a minute away', () => {
    const props = toRailRowProps(liveArrival({ arrivalTime: NOW_SEC + 30 }), NOW_SEC, FORMATTERS);
    expect(props.primaryText).toBe('Arriving');
  });

  it('omits the secondary line when on time', () => {
    const props = toRailRowProps(liveArrival({ delaySeconds: 0 }), NOW_SEC, FORMATTERS);
    expect(props.secondaryText).toBeUndefined();
  });

  it('uses warning severity and a "late" label when more than 3 minutes behind', () => {
    const props = toRailRowProps(
      liveArrival({ arrivalTime: NOW_SEC + 600, delaySeconds: 240 }),
      NOW_SEC,
      FORMATTERS,
    );
    expect(props.severity).toBe('warning');
    expect(props.secondaryText).toMatch(/4 min late/);
  });

  it('stays success but labels "early" when ahead of schedule', () => {
    const props = toRailRowProps(liveArrival({ delaySeconds: -120 }), NOW_SEC, FORMATTERS);
    expect(props.severity).toBe('success');
    expect(props.secondaryText).toMatch(/2 min early/);
  });
});

describe('toRailRowProps — scheduled', () => {
  const scheduled: RailArrivalDTO = {
    station: 'AIRPORT STATION',
    line: 'GOLD',
    direction: 'S',
    destination: 'Airport',
    trainId: '109',
    arrivalTime: NOW_SEC + 300, // 5 min out
    isRealtime: false,
  };

  it('still shows the countdown, but neutral with a "Scheduled" label', () => {
    const props = toRailRowProps(scheduled, NOW_SEC, FORMATTERS);
    expect(props.primaryText).toBe('5 min');
    expect(props.severity).toBe('neutral');
    expect(props.icon).toBe('clock');
    expect(props.secondaryText).toMatch(/Scheduled/);
  });
});
