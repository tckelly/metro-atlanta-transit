import { describe, it, expect } from 'vitest';

import { freshnessTier } from './freshnessTier';

const NOW = 1779465600;

describe('freshnessTier', () => {
  it('is "fresh" when refresh is healthy, regardless of timestamp age', () => {
    expect(freshnessTier({ lastUpdatedSec: NOW, isStale: false, nowSec: NOW })).toBe('fresh');
    expect(freshnessTier({ lastUpdatedSec: NOW - 30, isStale: false, nowSec: NOW })).toBe('fresh');
    expect(freshnessTier({ lastUpdatedSec: NOW - 999, isStale: false, nowSec: NOW })).toBe(
      'fresh',
    );
  });

  it('is "stale" when refresh is failing and data is under 5 minutes old', () => {
    expect(freshnessTier({ lastUpdatedSec: NOW, isStale: true, nowSec: NOW })).toBe('stale');
    expect(freshnessTier({ lastUpdatedSec: NOW - 60, isStale: true, nowSec: NOW })).toBe('stale');
    expect(freshnessTier({ lastUpdatedSec: NOW - 299, isStale: true, nowSec: NOW })).toBe('stale');
  });

  it('is "very_stale" when refresh is failing and data is 5 minutes or older', () => {
    expect(freshnessTier({ lastUpdatedSec: NOW - 300, isStale: true, nowSec: NOW })).toBe(
      'very_stale',
    );
    expect(freshnessTier({ lastUpdatedSec: NOW - 600, isStale: true, nowSec: NOW })).toBe(
      'very_stale',
    );
    expect(freshnessTier({ lastUpdatedSec: NOW - 60 * 60, isStale: true, nowSec: NOW })).toBe(
      'very_stale',
    );
  });

  it('treats future timestamps as zero age rather than negative', () => {
    // Clock skew shouldn't flip an actually-stale state into very_stale.
    expect(freshnessTier({ lastUpdatedSec: NOW + 100, isStale: true, nowSec: NOW })).toBe('stale');
  });
});
