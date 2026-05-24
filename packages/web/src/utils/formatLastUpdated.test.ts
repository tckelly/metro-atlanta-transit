import { describe, it, expect } from 'vitest';

import { formatLastUpdated } from './formatLastUpdated';

// Fixed reference for deterministic tests.
const NOW = 1779465600;

describe('formatLastUpdated', () => {
  it('shows "now" for ages under 5 seconds', () => {
    expect(formatLastUpdated(NOW, NOW)).toBe('now');
    expect(formatLastUpdated(NOW - 2, NOW)).toBe('now');
    expect(formatLastUpdated(NOW - 4, NOW)).toBe('now');
  });

  it('switches to "5 seconds ago" at exactly 5 seconds', () => {
    expect(formatLastUpdated(NOW - 5, NOW)).toBe('5 seconds ago');
  });

  it('buckets sub-minute ages to the nearest 5 seconds (floored)', () => {
    expect(formatLastUpdated(NOW - 9, NOW)).toBe('5 seconds ago');
    expect(formatLastUpdated(NOW - 10, NOW)).toBe('10 seconds ago');
    expect(formatLastUpdated(NOW - 14, NOW)).toBe('10 seconds ago');
    expect(formatLastUpdated(NOW - 30, NOW)).toBe('30 seconds ago');
    expect(formatLastUpdated(NOW - 45, NOW)).toBe('45 seconds ago');
    expect(formatLastUpdated(NOW - 59, NOW)).toBe('55 seconds ago');
  });

  it('switches to minutes at 60 seconds', () => {
    expect(formatLastUpdated(NOW - 60, NOW)).toBe('1 min ago');
    expect(formatLastUpdated(NOW - 90, NOW)).toBe('2 min ago');
    expect(formatLastUpdated(NOW - 119, NOW)).toBe('2 min ago');
    expect(formatLastUpdated(NOW - 120, NOW)).toBe('2 min ago');
    expect(formatLastUpdated(NOW - 5 * 60, NOW)).toBe('5 min ago');
  });

  it('treats future timestamps as "now" rather than negative ages', () => {
    // Clock skew shouldn't cause "−5 seconds ago".
    expect(formatLastUpdated(NOW + 100, NOW)).toBe('now');
  });
});
