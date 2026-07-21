import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, vi, afterEach } from 'vitest';

import { fetchRailArrivals, normalizeRailArrivals, type RailArrivalDTO } from './martaRail';

const here = dirname(fileURLToPath(import.meta.url));

/** The verbatim Phase-2 capture — 492 records, all 4 lines, system-wide. */
const REAL_PAYLOAD: unknown[] = JSON.parse(
  readFileSync(join(here, '../../../../sample-data/marta-rail-2026-07-13/traindata.json'), 'utf8'),
);

/** A live train: carries DELAY + position, per the Phase-2 invariant. */
const LIVE_RECORD = {
  STATION: 'FIVE POINTS STATION',
  LINE: 'RED',
  DIRECTION: 'N',
  DESTINATION: 'North Springs',
  TRAIN_ID: '402',
  NEXT_ARR: '06:51:15 PM',
  WAITING_TIME: '4 min',
  WAITING_SECONDS: '240',
  IS_REALTIME: 'true',
  EVENT_TIME: '07/13/2026 6:47:15 PM',
  DELAY: 'T45S',
  LATITUDE: '33.938214',
  LONGITUDE: '-84.357252',
};

/** A scheduled prediction: no DELAY, no position. */
const SCHEDULED_RECORD = {
  STATION: 'AIRPORT STATION',
  LINE: 'GOLD',
  DIRECTION: 'S',
  DESTINATION: 'Airport',
  TRAIN_ID: '109',
  NEXT_ARR: '06:55:00 PM',
  WAITING_TIME: 'Arriving',
  WAITING_SECONDS: '0',
  IS_REALTIME: 'false',
  EVENT_TIME: '07/13/2026 6:47:15 PM',
};

// Independent oracle: 2026-07-13 6:47:15 PM in Atlanta is EDT (UTC-4),
// so 18:47:15 local == 22:47:15 UTC. Computed here without the parser under test.
const EVENT_TIME_UNIX = Math.floor(Date.UTC(2026, 6, 13, 22, 47, 15) / 1000);

const NOW_SEC = 1_752_446_835; // arbitrary fixed "now" for deterministic fallback tests

function stubFetchJson(data: unknown, init?: ResponseInit): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        ...init,
      }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normalizeRailArrivals', () => {
  it('maps a live record to a normalized DTO', () => {
    const [dto] = normalizeRailArrivals([LIVE_RECORD], NOW_SEC);
    if (!dto) throw new Error('expected one arrival');

    const expected: RailArrivalDTO = {
      station: 'FIVE POINTS STATION',
      line: 'RED',
      direction: 'N',
      destination: 'North Springs',
      trainId: '402',
      arrivalTime: EVENT_TIME_UNIX + 240,
      isRealtime: true,
      delaySeconds: 45,
      latitude: 33.938214,
      longitude: -84.357252,
    };
    expect(dto).toEqual(expected);
  });

  it('anchors arrivalTime to EVENT_TIME, not to "now"', () => {
    // The countdown must survive the edge-cache window: arrivalTime is absolute,
    // derived from the feed timestamp + WAITING_SECONDS, independent of nowSec.
    const [dto] = normalizeRailArrivals([LIVE_RECORD], NOW_SEC);
    expect(dto?.arrivalTime).toBe(EVENT_TIME_UNIX + 240);
  });

  it('omits delay and position for a scheduled record', () => {
    const [dto] = normalizeRailArrivals([SCHEDULED_RECORD], NOW_SEC);
    if (!dto) throw new Error('expected one arrival');

    expect(dto.isRealtime).toBe(false);
    expect(dto.arrivalTime).toBe(EVENT_TIME_UNIX + 0);
    expect(dto).not.toHaveProperty('delaySeconds');
    expect(dto).not.toHaveProperty('latitude');
    expect(dto).not.toHaveProperty('longitude');
  });

  it('parses signed delay durations', () => {
    const early = { ...LIVE_RECORD, DELAY: 'T-7S' };
    const onTime = { ...LIVE_RECORD, DELAY: 'T0S' };
    expect(normalizeRailArrivals([early], NOW_SEC)[0]?.delaySeconds).toBe(-7);
    expect(normalizeRailArrivals([onTime], NOW_SEC)[0]?.delaySeconds).toBe(0);
  });

  it('falls back to now + WAITING_SECONDS when EVENT_TIME is unparseable', () => {
    const bad = { ...LIVE_RECORD, EVENT_TIME: 'not a timestamp' };
    const [dto] = normalizeRailArrivals([bad], NOW_SEC);
    expect(dto?.arrivalTime).toBe(NOW_SEC + 240);
  });

  it('drops a record whose WAITING_SECONDS is not numeric (no usable ETA)', () => {
    const bad = { ...LIVE_RECORD, WAITING_SECONDS: 'soon' };
    expect(normalizeRailArrivals([bad], NOW_SEC)).toEqual([]);
  });

  it('drops a malformed record but keeps the valid ones (graceful degradation)', () => {
    const mixed = [LIVE_RECORD, { STATION: 'BROKEN' }, SCHEDULED_RECORD];
    const out = normalizeRailArrivals(mixed, NOW_SEC);
    expect(out.map((d) => d.trainId)).toEqual(['402', '109']);
  });

  it('ignores an unparseable optional DELAY without dropping the record', () => {
    const weird = { ...LIVE_RECORD, DELAY: 'garbage' };
    const [dto] = normalizeRailArrivals([weird], NOW_SEC);
    if (!dto) throw new Error('expected the record to survive');
    expect(dto).not.toHaveProperty('delaySeconds');
  });

  it('returns [] for a non-array input', () => {
    expect(normalizeRailArrivals({ not: 'an array' }, NOW_SEC)).toEqual([]);
  });

  it('normalizes every record in the real captured payload', () => {
    const out = normalizeRailArrivals(REAL_PAYLOAD, NOW_SEC);
    expect(out).toHaveLength(REAL_PAYLOAD.length);
    // Every DTO has the required core fields and a finite absolute arrival time.
    for (const dto of out) {
      expect(typeof dto.station).toBe('string');
      expect(['RED', 'GOLD', 'BLUE', 'GREEN']).toContain(dto.line);
      expect(Number.isFinite(dto.arrivalTime)).toBe(true);
    }
  });
});

describe('fetchRailArrivals', () => {
  it('fetches the rail proxy endpoint and returns normalized DTOs', async () => {
    const fetchMock = stubFetchJson([LIVE_RECORD, SCHEDULED_RECORD]);
    const out = await fetchRailArrivals();

    expect(out.map((d) => d.trainId)).toEqual(['402', '109']);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/marta/rail'),
      expect.objectContaining({}),
    );
  });

  it('passes an AbortSignal through to fetch', async () => {
    const fetchMock = stubFetchJson([LIVE_RECORD]);
    const controller = new AbortController();
    await fetchRailArrivals(controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('throws when the proxy returns a non-2xx status', async () => {
    stubFetchJson('Rail upstream unreachable.', { status: 502, statusText: 'Bad Gateway' });
    await expect(fetchRailArrivals()).rejects.toThrow(/502/);
  });
});
