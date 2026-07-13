import { describe, it, expect } from 'vitest';

import { formatDirections, formatDirectionPair, type DirectionsLabelStrings } from './directionsLabel';
import type { StopDirection } from '../buildtime/preprocessGtfs';

// Fake string-builders so the pure formatter is testable without i18n. The web
// surfaces supply the real ones from `t`. Visible uses the "→" glyph; the
// spoken form uses "toward" for screen readers (approach chosen for a11y).
const STRINGS: DirectionsLabelStrings = {
  pair: (route, headsign) => `${route} → ${headsign}`,
  pairSpoken: (route, headsign) => `Route ${route} toward ${headsign}`,
  more: (count) => `+${count} more`,
  moreSpoken: (count) => `and ${count} more`,
};

// Route ids resolve to their short name by stripping a leading "R".
const resolveShortName = (routeId: string): string => routeId.replace(/^R/, '');

const dir = (routeId: string, headsign: string): StopDirection => ({ routeId, headsign });

describe('formatDirectionPair', () => {
  it('pairs the visible glyph form with the spoken accessible form', () => {
    expect(formatDirectionPair('11', 'Executive Park', STRINGS)).toEqual({
      visible: '11 → Executive Park',
      label: 'Route 11 toward Executive Park',
    });
  });
});

describe('formatDirections', () => {
  it('returns null when there are no directions (name-only fallback)', () => {
    expect(formatDirections([], resolveShortName, STRINGS)).toBeNull();
  });

  it('returns null when directions is missing entirely (stale/partial bundle)', () => {
    // A stops.json built before the `directions` field omits it, so the value
    // is undefined at runtime despite the type. Degrade to name-only, not crash.
    expect(formatDirections(undefined, resolveShortName, STRINGS)).toBeNull();
  });

  it('renders a single pair as visible glyph text plus a spoken label', () => {
    const result = formatDirections([dir('R11', 'Collier Rd')], resolveShortName, STRINGS);
    expect(result).toEqual({
      visible: '11 → Collier Rd',
      label: 'Route 11 toward Collier Rd',
    });
  });

  it('joins multiple pairs up to the limit', () => {
    const result = formatDirections(
      [dir('R11', 'Collier Rd'), dir('R11', 'Executive Park')],
      resolveShortName,
      STRINGS,
      2,
    );
    expect(result).toEqual({
      visible: '11 → Collier Rd, 11 → Executive Park',
      label: 'Route 11 toward Collier Rd, Route 11 toward Executive Park',
    });
  });

  it('truncates beyond the limit with a "+N more" suffix in both forms', () => {
    const result = formatDirections(
      [dir('R11', 'Collier Rd'), dir('R11', 'Executive Park'), dir('R36', 'Decatur'), dir('R2', 'Inman')],
      resolveShortName,
      STRINGS,
      2,
    );
    // 4 pairs, limit 2 → show 2, "+2 more".
    expect(result).toEqual({
      visible: '11 → Collier Rd, 11 → Executive Park, +2 more',
      label: 'Route 11 toward Collier Rd, Route 11 toward Executive Park, and 2 more',
    });
  });
});
