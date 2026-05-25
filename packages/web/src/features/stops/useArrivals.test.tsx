import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TripUpdate, VehiclePosition } from '@atl-transit/gtfs';

import { useArrivals } from './useArrivals';
import {
  RealtimeFeedContext,
  type RealtimeFeedSnapshot,
} from '../realtime/RealtimeFeedContext';
import type { GtfsBundle } from '../../buildtime/preprocessGtfs';

// Single scheduled visit at 06:01:56 EDT on 2026-05-22 for stop 134013.
const BUNDLE: GtfsBundle = {
  stops: [{ stopId: '134013', name: 'Test Stop', lat: 0, lng: 0, routeIds: ['116'] }],
  routes: [{ routeId: '116', shortName: '116', longName: 'Test' }],
  trips: [{ tripId: '10802068', routeId: '116', serviceId: 'WEEKDAY', headsign: 'Decatur' }],
  stopTimes: [
    {
      tripId: '10802068',
      stopId: '134013',
      stopSequence: 53,
      arrivalTime: '06:01:56',
      departureTime: '06:01:56',
    },
  ],
  calendar: {
    rules: [
      {
        serviceId: 'WEEKDAY',
        weekdays: [true, true, true, true, true, false, false],
        startDate: '20260101',
        endDate: '20261231',
      },
    ],
    exceptions: [],
  },
};

const LIVE_TRIP_UPDATE: TripUpdate = {
  tripId: '10802068',
  routeId: '116',
  scheduleRelationship: 'SCHEDULED',
  stopTimeUpdates: [
    {
      stopId: '134013',
      stopSequence: 53,
      arrivalTime: 1779467993, // 06:39:53 EDT
      scheduleRelationship: 'SCHEDULED',
    },
  ],
};

const SUCCESS_SNAPSHOT = (overrides: Partial<RealtimeFeedSnapshot> = {}): RealtimeFeedSnapshot => ({
  status: 'success',
  tripUpdates: [LIVE_TRIP_UPDATE],
  vehiclePositions: [],
  lastUpdated: 1779444000,
  isStale: false,
  error: null,
  refresh: vi.fn(async () => {}),
  ...overrides,
});

function wrap(snapshot: RealtimeFeedSnapshot) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RealtimeFeedContext.Provider value={snapshot}>{children}</RealtimeFeedContext.Provider>
    );
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  // Pin clock to 06:00 EDT 2026-05-22 so the scheduled visit at 06:01:56
  // falls inside the forward window.
  vi.setSystemTime(new Date(1779444000 * 1000));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useArrivals', () => {
  it('returns empty rows while the feed is still loading', () => {
    const snapshot = SUCCESS_SNAPSHOT({
      status: 'loading',
      tripUpdates: [],
      lastUpdated: null,
    });
    const { result } = renderHook(() => useArrivals('134013', BUNDLE, { date: '20260522' }), {
      wrapper: wrap(snapshot),
    });

    expect(result.current.status).toBe('loading');
    expect(result.current.rows).toEqual([]);
  });

  it('classifies scheduled visits with live trip updates for the requested stop', () => {
    const { result } = renderHook(() => useArrivals('134013', BUNDLE, { date: '20260522' }), {
      wrapper: wrap(SUCCESS_SNAPSHOT()),
    });

    expect(result.current.status).toBe('success');
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.status).toBe('live');
    expect(result.current.rows[0]?.predictedTime).toBe(1779467993);
  });

  it('passes through lastUpdated, isStale, and error from the feed', () => {
    const error = new Error('boom');
    const snapshot = SUCCESS_SNAPSHOT({
      isStale: true,
      error,
      lastUpdated: 1779443999,
    });
    const { result } = renderHook(() => useArrivals('134013', BUNDLE, { date: '20260522' }), {
      wrapper: wrap(snapshot),
    });

    expect(result.current.lastUpdated).toBe(1779443999);
    expect(result.current.isStale).toBe(true);
    expect(result.current.error).toBe(error);
  });

  it('returns empty rows when the feed is in error and there is no prior data', () => {
    const snapshot = SUCCESS_SNAPSHOT({
      status: 'error',
      tripUpdates: [],
      lastUpdated: null,
      error: new Error('upstream'),
    });
    const { result } = renderHook(() => useArrivals('134013', BUNDLE, { date: '20260522' }), {
      wrapper: wrap(snapshot),
    });

    expect(result.current.status).toBe('error');
    expect(result.current.rows).toEqual([]);
  });

  it('filters by stopId — only rows for the requested stop are returned', () => {
    // Two scheduled visits across two stops; ask for one stop, get one row.
    const bundle: GtfsBundle = {
      ...BUNDLE,
      stops: [
        ...BUNDLE.stops,
        { stopId: 'other', name: 'Other', lat: 0, lng: 0, routeIds: ['116'] },
      ],
      trips: [
        ...BUNDLE.trips,
        { tripId: 'other-trip', routeId: '116', serviceId: 'WEEKDAY', headsign: 'Decatur' },
      ],
      stopTimes: [
        ...BUNDLE.stopTimes,
        {
          tripId: 'other-trip',
          stopId: 'other',
          stopSequence: 1,
          arrivalTime: '06:02:00',
          departureTime: '06:02:00',
        },
      ],
    };
    const { result } = renderHook(() => useArrivals('134013', bundle, { date: '20260522' }), {
      wrapper: wrap(SUCCESS_SNAPSHOT()),
    });

    expect(result.current.rows.every((r) => r.tripId === '10802068')).toBe(true);
  });

  it('attaches occupancy from a matching vehicle position', () => {
    const vehicle: VehiclePosition = {
      tripId: '10802068',
      routeId: '116',
      vehicleId: 'V1',
      timestamp: 1779444000,
      latitude: 33.7540,
      longitude: -84.3915,
      occupancyStatus: 'FEW_SEATS_AVAILABLE',
    };
    const snapshot = SUCCESS_SNAPSHOT({ vehiclePositions: [vehicle] });
    const { result } = renderHook(() => useArrivals('134013', BUNDLE, { date: '20260522' }), {
      wrapper: wrap(snapshot),
    });

    expect(result.current.rows[0]?.occupancy).toBe('FEW_SEATS_AVAILABLE');
  });

  it('refresh() proxies to feed.refresh()', () => {
    const refresh = vi.fn(async () => {});
    const snapshot = SUCCESS_SNAPSHOT({ refresh });
    const { result } = renderHook(() => useArrivals('134013', BUNDLE, { date: '20260522' }), {
      wrapper: wrap(snapshot),
    });

    act(() => {
      result.current.refresh();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('throws when called outside a RealtimeFeedProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      renderHook(() => useArrivals('134013', BUNDLE, { date: '20260522' })),
    ).toThrow(/RealtimeFeedProvider/);
    spy.mockRestore();
  });
});
