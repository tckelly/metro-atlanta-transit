import { describe, it, expect } from 'vitest';

import { formatLastUpdated } from './formatLastUpdated';
import { i18next } from '../i18n/init';

// Real i18next.t — initialized in test-setup, English by default.
const t = i18next.t.bind(i18next);

// Fixed reference for deterministic tests.
const NOW = 1779465600;

describe('formatLastUpdated', () => {
  it('shows "now" for ages under 15 seconds', () => {
    expect(formatLastUpdated(NOW, NOW, t)).toBe('now');
    expect(formatLastUpdated(NOW - 5, NOW, t)).toBe('now');
    expect(formatLastUpdated(NOW - 14, NOW, t)).toBe('now');
  });

  it('switches to "15 seconds ago" at exactly 15 seconds', () => {
    expect(formatLastUpdated(NOW - 15, NOW, t)).toBe('15 seconds ago');
  });

  it('buckets sub-minute ages to the nearest 15 seconds (floored)', () => {
    expect(formatLastUpdated(NOW - 29, NOW, t)).toBe('15 seconds ago');
    expect(formatLastUpdated(NOW - 30, NOW, t)).toBe('30 seconds ago');
    expect(formatLastUpdated(NOW - 44, NOW, t)).toBe('30 seconds ago');
    expect(formatLastUpdated(NOW - 45, NOW, t)).toBe('45 seconds ago');
    expect(formatLastUpdated(NOW - 59, NOW, t)).toBe('45 seconds ago');
  });

  it('switches to minutes at 60 seconds', () => {
    expect(formatLastUpdated(NOW - 60, NOW, t)).toBe('1 min ago');
    expect(formatLastUpdated(NOW - 90, NOW, t)).toBe('2 min ago');
    expect(formatLastUpdated(NOW - 119, NOW, t)).toBe('2 min ago');
    expect(formatLastUpdated(NOW - 120, NOW, t)).toBe('2 min ago');
    expect(formatLastUpdated(NOW - 5 * 60, NOW, t)).toBe('5 min ago');
  });

  it('treats future timestamps as "now" rather than negative ages', () => {
    expect(formatLastUpdated(NOW + 100, NOW, t)).toBe('now');
  });
});
