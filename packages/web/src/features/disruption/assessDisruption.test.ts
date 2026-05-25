import { describe, it, expect } from 'vitest';

import { assessDisruption } from './assessDisruption';
import type { ClassifiedBusRow } from '../stops/busRowClassifier';

function row(status: ClassifiedBusRow['status'], tripId = String(Math.random())): ClassifiedBusRow {
  return {
    tripId,
    routeId: '116',
    scheduledTime: 0,
    headsign: 'Decatur',
    status,
  };
}

describe('assessDisruption', () => {
  it('returns "none" when there are no cancelled rows', () => {
    expect(assessDisruption([row('live'), row('live'), row('no_live_data')])).toBe('none');
  });

  it('returns "soft" for exactly one cancellation', () => {
    expect(assessDisruption([row('cancelled'), row('live'), row('live')])).toBe('soft');
  });

  it('returns "strong" for two cancellations', () => {
    expect(assessDisruption([row('cancelled'), row('cancelled'), row('live')])).toBe('strong');
  });

  it('returns "strong" for three or more cancellations', () => {
    expect(
      assessDisruption([row('cancelled'), row('cancelled'), row('cancelled'), row('live')]),
    ).toBe('strong');
  });

  it('returns "none" for an empty list', () => {
    expect(assessDisruption([])).toBe('none');
  });

  it('ignores no_live_data rows — only cancellations count', () => {
    expect(assessDisruption([row('no_live_data'), row('no_live_data'), row('live')])).toBe(
      'none',
    );
  });

  it('still escalates when the only rows are cancelled', () => {
    expect(assessDisruption([row('cancelled'), row('cancelled')])).toBe('strong');
  });
});
