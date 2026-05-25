import { describe, it, expect } from 'vitest';

import { toBusRowProps, type BusRowMapperFormatters } from './busRowMapper';
import type { ClassifiedBusRow } from './busRowClassifier';
import { i18next } from '../../i18n/init';
import { formatTime } from '../../i18n/formatters';

// Fixed reference time for deterministic tests. 2026-05-22 12:00 EDT.
const NOW_SEC = 1779465600;

/**
 * Stable formatter bundle for these tests: English + 24-hour + Atlanta
 * timezone. Matches the pre-i18n behavior the existing assertions were
 * written against. The hook layer (`useFormatTime`) reads from settings
 * + locale in real use; this fixture replaces those for a pure unit
 * test of the mapper.
 */
const FORMATTERS: BusRowMapperFormatters = {
  t: i18next.t.bind(i18next),
  formatTime: (unixSec) =>
    formatTime(unixSec, {
      locale: 'en',
      hour12: false,
      timeZone: 'America/New_York',
    }),
};

function liveRow(overrides: Partial<ClassifiedBusRow> = {}): ClassifiedBusRow {
  return {
    tripId: 'T1',
    routeId: 'R36',
    scheduledTime: NOW_SEC + 180, // scheduled 3 min from now
    headsign: 'Decatur Station',
    status: 'live',
    predictedTime: NOW_SEC + 180,
    delaySec: 0,
    ...overrides,
  };
}

describe('toBusRowProps — live, on-time', () => {
  it('shows ETA as "X min" with success severity and clock icon', () => {
    const props = toBusRowProps(liveRow({ predictedTime: NOW_SEC + 180 }), NOW_SEC, FORMATTERS);
    expect(props.primaryText).toBe('3 min');
    expect(props.severity).toBe('success');
    expect(props.icon).toBe('clock');
    expect(props.primaryStyle ?? 'normal').toBe('normal');
  });

  it('shows "Arriving" when predicted time is less than a minute away', () => {
    const props = toBusRowProps(liveRow({ predictedTime: NOW_SEC + 45 }), NOW_SEC, FORMATTERS);
    expect(props.primaryText).toBe('Arriving');
    expect(props.severity).toBe('success');
  });

  it('shows scheduled clock time instead of "X min" when ETA is 60+ minutes out', () => {
    const props = toBusRowProps(
      liveRow({
        scheduledTime: 1779465600 + 98 * 60,
        predictedTime: 1779465600 + 98 * 60,
      }),
      1779465600,
      FORMATTERS,
    );
    expect(props.primaryText).toBe('13:38');
  });

  it('still shows minutes when ETA is just under 60 minutes', () => {
    const props = toBusRowProps(
      liveRow({ predictedTime: NOW_SEC + 59 * 60 }),
      NOW_SEC,
      FORMATTERS,
    );
    expect(props.primaryText).toBe('59 min');
  });

  it('includes scheduled time in the secondary line', () => {
    const props = toBusRowProps(liveRow({ scheduledTime: NOW_SEC }), NOW_SEC + 60, FORMATTERS);
    expect(props.secondaryText).toContain('12:00');
    expect(props.secondaryText).toMatch(/Scheduled/);
  });
});

describe('toBusRowProps — live, delayed', () => {
  it('uses warning severity when delay exceeds 3 minutes', () => {
    const props = toBusRowProps(
      liveRow({ predictedTime: NOW_SEC + 600, delaySec: 240 }),
      NOW_SEC,
      FORMATTERS,
    );
    expect(props.severity).toBe('warning');
    expect(props.icon).toBe('clock');
    expect(props.primaryText).toBe('10 min');
  });

  it('stays "success" when delay is small (under 3 min late)', () => {
    const props = toBusRowProps(
      liveRow({ predictedTime: NOW_SEC + 360, delaySec: 60 }),
      NOW_SEC,
      FORMATTERS,
    );
    expect(props.severity).toBe('success');
  });

  it('mentions the delay magnitude in the secondary line', () => {
    const props = toBusRowProps(
      liveRow({ predictedTime: NOW_SEC + 600, delaySec: 240 }),
      NOW_SEC,
      FORMATTERS,
    );
    expect(props.secondaryText).toMatch(/4 min late/);
  });

  it('mentions "early" when running ahead of schedule', () => {
    const props = toBusRowProps(
      liveRow({ predictedTime: NOW_SEC + 60, delaySec: -120 }),
      NOW_SEC,
      FORMATTERS,
    );
    expect(props.secondaryText).toMatch(/2 min early/);
  });
});

describe('toBusRowProps — cancelled', () => {
  it('renders "Cancelled" with danger severity, strikethrough, and warning icon', () => {
    const row: ClassifiedBusRow = {
      tripId: 'T1',
      routeId: 'R36',
      scheduledTime: NOW_SEC + 180,
      headsign: 'Decatur Station',
      status: 'cancelled',
    };
    const props = toBusRowProps(row, NOW_SEC, FORMATTERS);
    expect(props.primaryText).toBe('Cancelled');
    expect(props.severity).toBe('danger');
    expect(props.primaryStyle).toBe('strikethrough');
    expect(props.icon).toBe('warning');
  });

  it('includes the scheduled time so the user can see which trip was cancelled', () => {
    const row: ClassifiedBusRow = {
      tripId: 'T1',
      routeId: 'R36',
      scheduledTime: NOW_SEC,
      headsign: 'Decatur Station',
      status: 'cancelled',
    };
    const props = toBusRowProps(row, NOW_SEC + 60, FORMATTERS);
    expect(props.secondaryText).toContain('12:00');
    expect(props.secondaryText).toMatch(/Scheduled/);
  });
});

describe('toBusRowProps — occupancy', () => {
  it('appends "Seats available" for EMPTY', () => {
    const props = toBusRowProps(liveRow({ occupancy: 'EMPTY' }), NOW_SEC, FORMATTERS);
    expect(props.secondaryText).toMatch(/Seats available/);
  });

  it('appends "Seats available" for MANY_SEATS_AVAILABLE', () => {
    const props = toBusRowProps(liveRow({ occupancy: 'MANY_SEATS_AVAILABLE' }), NOW_SEC, FORMATTERS);
    expect(props.secondaryText).toMatch(/Seats available/);
  });

  it('appends "Filling up" for FEW_SEATS_AVAILABLE', () => {
    const props = toBusRowProps(liveRow({ occupancy: 'FEW_SEATS_AVAILABLE' }), NOW_SEC, FORMATTERS);
    expect(props.secondaryText).toMatch(/Filling up/);
  });

  it('appends "Standing room only" for STANDING_ROOM_ONLY', () => {
    const props = toBusRowProps(liveRow({ occupancy: 'STANDING_ROOM_ONLY' }), NOW_SEC, FORMATTERS);
    expect(props.secondaryText).toMatch(/Standing room only/);
  });

  it('appends "Very crowded" for CRUSHED_STANDING_ROOM_ONLY and FULL', () => {
    expect(
      toBusRowProps(liveRow({ occupancy: 'CRUSHED_STANDING_ROOM_ONLY' }), NOW_SEC, FORMATTERS).secondaryText,
    ).toMatch(/Very crowded/);
    expect(
      toBusRowProps(liveRow({ occupancy: 'FULL' }), NOW_SEC, FORMATTERS).secondaryText,
    ).toMatch(/Very crowded/);
  });

  it('appends "Not accepting riders" for NOT_ACCEPTING_PASSENGERS', () => {
    const props = toBusRowProps(
      liveRow({ occupancy: 'NOT_ACCEPTING_PASSENGERS' }),
      NOW_SEC,
      FORMATTERS,
    );
    expect(props.secondaryText).toMatch(/Not accepting riders/);
  });

  it('omits the label entirely for NO_DATA_AVAILABLE and NOT_BOARDABLE', () => {
    const noData = toBusRowProps(liveRow({ occupancy: 'NO_DATA_AVAILABLE' }), NOW_SEC, FORMATTERS);
    const notBoardable = toBusRowProps(liveRow({ occupancy: 'NOT_BOARDABLE' }), NOW_SEC, FORMATTERS);
    expect(noData.secondaryText).not.toMatch(/Seats|crowded|riders|Filling|Standing/);
    expect(notBoardable.secondaryText).not.toMatch(/Seats|crowded|riders|Filling|Standing/);
  });

  it('omits the label entirely when occupancy is not reported', () => {
    const props = toBusRowProps(liveRow(), NOW_SEC, FORMATTERS);
    expect(props.secondaryText).not.toMatch(/Seats|crowded|riders|Filling|Standing/);
  });

  it('keeps occupancy text separate from delay text in the secondary line', () => {
    const props = toBusRowProps(
      liveRow({
        predictedTime: NOW_SEC + 600,
        delaySec: 240,
        occupancy: 'FEW_SEATS_AVAILABLE',
      }),
      NOW_SEC,
      FORMATTERS,
    );
    expect(props.secondaryText).toMatch(/4 min late/);
    expect(props.secondaryText).toMatch(/Filling up/);
  });
});

describe('toBusRowProps — no live data', () => {
  it('shows the scheduled time as the primary text', () => {
    const row: ClassifiedBusRow = {
      tripId: 'T1',
      routeId: 'R36',
      scheduledTime: NOW_SEC,
      headsign: 'Decatur Station',
      status: 'no_live_data',
    };
    const props = toBusRowProps(row, NOW_SEC, FORMATTERS);
    expect(props.primaryText).toBe('12:00');
    expect(props.severity).toBe('neutral');
    expect(props.icon).toBe('clock');
  });

  it('says "No live data" in the secondary line', () => {
    const row: ClassifiedBusRow = {
      tripId: 'T1',
      routeId: 'R36',
      scheduledTime: NOW_SEC,
      headsign: 'Decatur Station',
      status: 'no_live_data',
    };
    const props = toBusRowProps(row, NOW_SEC, FORMATTERS);
    expect(props.secondaryText).toMatch(/No live data/);
  });
});
