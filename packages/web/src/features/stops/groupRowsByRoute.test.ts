import { describe, it, expect } from 'vitest';

import type { ClassifiedBusRow } from './busRowClassifier';
import { groupRowsByRoute } from './groupRowsByRoute';

function row(overrides: Partial<ClassifiedBusRow> = {}): ClassifiedBusRow {
  return {
    tripId: 'T',
    routeId: 'R',
    stopSequence: 1,
    scheduledTime: 0,
    headsign: 'H',
    status: 'no_live_data',
    ...overrides,
  };
}

describe('groupRowsByRoute', () => {
  it('returns an empty array for empty input', () => {
    expect(groupRowsByRoute([])).toEqual([]);
  });

  it('puts rows that share routeId and headsign into one group', () => {
    const groups = groupRowsByRoute([
      row({ tripId: 'T1', routeId: '36', headsign: 'Decatur Station' }),
      row({ tripId: 'T2', routeId: '36', headsign: 'Decatur Station' }),
      row({ tripId: 'T3', routeId: '36', headsign: 'Decatur Station' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.routeId).toBe('36');
    expect(groups[0]?.headsign).toBe('Decatur Station');
    expect(groups[0]?.rows.map((r) => r.tripId)).toEqual(['T1', 'T2', 'T3']);
  });

  it('creates separate groups per distinct routeId', () => {
    const groups = groupRowsByRoute([
      row({ tripId: 'A', routeId: '36', headsign: 'X' }),
      row({ tripId: 'B', routeId: '102', headsign: 'Y' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.routeId).toBe('36');
    expect(groups[1]?.routeId).toBe('102');
  });

  it('creates separate groups when the same route has different headsigns', () => {
    // A route serving the same stop in opposite directions has two headsigns.
    const groups = groupRowsByRoute([
      row({ tripId: 'A', routeId: '36', headsign: 'Decatur Station' }),
      row({ tripId: 'B', routeId: '36', headsign: 'Midtown Station' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.headsign).toBe('Decatur Station');
    expect(groups[1]?.headsign).toBe('Midtown Station');
  });

  it('preserves first-appearance order across groups and within each group', () => {
    const groups = groupRowsByRoute([
      row({ tripId: 'T1', routeId: '36', headsign: 'D', scheduledTime: 100 }),
      row({ tripId: 'T2', routeId: '102', headsign: 'L', scheduledTime: 110 }),
      row({ tripId: 'T3', routeId: '36', headsign: 'D', scheduledTime: 120 }),
      row({ tripId: 'T4', routeId: '102', headsign: 'L', scheduledTime: 130 }),
    ]);
    expect(groups.map((g) => g.routeId)).toEqual(['36', '102']);
    expect(groups[0]?.rows.map((r) => r.tripId)).toEqual(['T1', 'T3']);
    expect(groups[1]?.rows.map((r) => r.tripId)).toEqual(['T2', 'T4']);
  });
});
