import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { decodeAlerts } from './alerts';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../sample-data/marta-gtfs-rt-2026-05-22/al.pb');
const alertBytes = new Uint8Array(readFileSync(fixturePath));

describe('decodeAlerts against the 2026-05-22 snapshot', () => {
  it('parses the feed header timestamp', () => {
    const feed = decodeAlerts(alertBytes);
    expect(feed.feedTimestamp).toBe(1779468884);
  });

  it('returns an empty alerts array — MARTA published nothing in this snapshot', () => {
    const feed = decodeAlerts(alertBytes);
    expect(feed.alerts).toEqual([]);
  });

  it('throws on invalid input', () => {
    expect(() => decodeAlerts(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toThrow();
  });
});
