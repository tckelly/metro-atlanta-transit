import { describe, it, expect } from 'vitest';

import { toBusRowProps } from './busRowMapper';
import type { ClassifiedBusRow } from './busRowClassifier';

// Fixed reference time for deterministic tests. 2026-05-22 12:00 EDT.
const NOW_SEC = 1779465600;

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
    const props = toBusRowProps(liveRow({ predictedTime: NOW_SEC + 180 }), NOW_SEC);
    expect(props.primaryText).toBe('3 min');
    expect(props.severity).toBe('success');
    expect(props.icon).toBe('clock');
    expect(props.primaryStyle ?? 'normal').toBe('normal');
  });

  it('shows "Arriving" when predicted time is less than a minute away', () => {
    const props = toBusRowProps(liveRow({ predictedTime: NOW_SEC + 45 }), NOW_SEC);
    expect(props.primaryText).toBe('Arriving');
    expect(props.severity).toBe('success');
  });

  it('shows scheduled clock time instead of "X min" when ETA is 60+ minutes out', () => {
    // 98 min away — "98 min" in a 32px bold reads as a quirk, not info.
    // Switch to the clock-time presentation at the 60-minute boundary.
    const props = toBusRowProps(
      liveRow({
        scheduledTime: 1779465600 + 98 * 60, // 13:38 EDT 2026-05-22
        predictedTime: 1779465600 + 98 * 60,
      }),
      1779465600,
    );
    expect(props.primaryText).toBe('13:38');
  });

  it('still shows minutes when ETA is just under 60 minutes', () => {
    const props = toBusRowProps(
      liveRow({
        predictedTime: NOW_SEC + 59 * 60,
      }),
      NOW_SEC,
    );
    expect(props.primaryText).toBe('59 min');
  });

  it('includes scheduled time in the secondary line', () => {
    // scheduledTime: 2026-05-22 12:00 EDT = 12:00 in local Atlanta display
    const props = toBusRowProps(liveRow({ scheduledTime: NOW_SEC }), NOW_SEC + 60);
    expect(props.secondaryText).toContain('12:00');
    expect(props.secondaryText).toMatch(/Scheduled/);
  });
});

describe('toBusRowProps — live, delayed', () => {
  it('uses warning severity when delay exceeds 3 minutes', () => {
    const props = toBusRowProps(
      liveRow({
        predictedTime: NOW_SEC + 600, // 10 min from now
        delaySec: 240, // 4 min late
      }),
      NOW_SEC,
    );
    expect(props.severity).toBe('warning');
    expect(props.icon).toBe('clock');
    expect(props.primaryText).toBe('10 min');
  });

  it('stays "success" when delay is small (under 3 min late)', () => {
    const props = toBusRowProps(
      liveRow({
        predictedTime: NOW_SEC + 360,
        delaySec: 60, // 1 min late
      }),
      NOW_SEC,
    );
    expect(props.severity).toBe('success');
  });

  it('mentions the delay magnitude in the secondary line', () => {
    const props = toBusRowProps(
      liveRow({
        predictedTime: NOW_SEC + 600,
        delaySec: 240,
      }),
      NOW_SEC,
    );
    expect(props.secondaryText).toMatch(/4 min late/);
  });

  it('mentions "early" when running ahead of schedule', () => {
    const props = toBusRowProps(
      liveRow({
        predictedTime: NOW_SEC + 60,
        delaySec: -120,
      }),
      NOW_SEC,
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
    const props = toBusRowProps(row, NOW_SEC);
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
    const props = toBusRowProps(row, NOW_SEC + 60);
    expect(props.secondaryText).toContain('12:00');
    expect(props.secondaryText).toMatch(/Scheduled/);
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
    const props = toBusRowProps(row, NOW_SEC);
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
    const props = toBusRowProps(row, NOW_SEC);
    expect(props.secondaryText).toMatch(/No live data/);
  });
});
