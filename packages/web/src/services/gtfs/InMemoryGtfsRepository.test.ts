import { describe, it, expect } from 'vitest';

import { InMemoryGtfsRepository } from './InMemoryGtfsRepository';
import type { GtfsBundle, StopOut } from '../../buildtime/preprocessGtfs';

const STOPS: StopOut[] = [
  { stopId: 'S1', name: 'Stop One', lat: 33.7540, lng: -84.3915, routeIds: ['116'] },
  { stopId: 'S2', name: 'Stop Two', lat: 33.7544, lng: -84.3915, routeIds: ['116'] },
  { stopId: 'S3', name: 'Far Away',  lat: 34.0000, lng: -84.0000, routeIds: ['999'] },
];

const BUNDLE: GtfsBundle = {
  stops: STOPS,
  routes: [
    { routeId: '116', shortName: '116', longName: 'Decatur via Avondale' },
    { routeId: '999', shortName: '999', longName: 'Test' },
  ],
  trips: [
    { tripId: 'T1', routeId: '116', serviceId: 'WK', headsign: 'Decatur' },
  ],
  stopTimes: [
    {
      tripId: 'T1',
      stopId: 'S1',
      stopSequence: 1,
      arrivalTime: '06:00:00',
      departureTime: '06:00:00',
    },
    {
      tripId: 'T1',
      stopId: 'S2',
      stopSequence: 2,
      arrivalTime: '06:05:00',
      departureTime: '06:05:00',
    },
  ],
  calendar: {
    rules: [
      {
        serviceId: 'WK',
        weekdays: [true, true, true, true, true, false, false],
        startDate: '20260101',
        endDate: '20261231',
      },
    ],
    exceptions: [],
  },
};

describe('InMemoryGtfsRepository — sync metadata', () => {
  it('getStop returns the matching stop', () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    expect(repo.getStop('S1')?.name).toBe('Stop One');
  });

  it('getStop returns undefined for unknown stopId', () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    expect(repo.getStop('nope')).toBeUndefined();
  });

  it('getRoute returns the matching route', () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    expect(repo.getRoute('116')?.longName).toBe('Decatur via Avondale');
  });

  it('getRoute returns undefined for unknown routeId', () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    expect(repo.getRoute('nope')).toBeUndefined();
  });

  it('listStops returns every stop in the bundle', () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    expect(repo.listStops()).toHaveLength(3);
    expect(repo.listStops().map((s) => s.stopId)).toEqual(['S1', 'S2', 'S3']);
  });

  it('listRoutes returns every route in the bundle', () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    expect(repo.listRoutes()).toHaveLength(2);
  });
});

describe('InMemoryGtfsRepository — async queries', () => {
  it('getScheduledVisitsForStop returns the day\'s scheduled visits', async () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    const visits = await repo.getScheduledVisitsForStop({
      stopId: 'S1',
      date: '20260105', // a Monday in our calendar
    });
    expect(visits).toHaveLength(1);
    expect(visits[0]?.tripId).toBe('T1');
    expect(visits[0]?.headsign).toBe('Decatur');
  });

  it('getScheduledVisitsForStop honors the count cap when nowSec is given', async () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    const visits = await repo.getScheduledVisitsForStop({
      stopId: 'S1',
      date: '20260105',
      // 06:00 EDT on 2026-01-05 in Unix seconds — the bus is "now"
      nowSec: 1767611400,
      count: 5,
    });
    expect(visits.length).toBeLessThanOrEqual(5);
  });

  it('getScheduledVisitsForStop returns empty array for unknown stop', async () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    const visits = await repo.getScheduledVisitsForStop({
      stopId: 'unknown',
      date: '20260105',
    });
    expect(visits).toEqual([]);
  });

  it('getRouteDirections returns the headsign-grouped stop list', async () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    const directions = await repo.getRouteDirections('116');
    expect(directions).toHaveLength(1);
    expect(directions[0]?.headsign).toBe('Decatur');
    expect(directions[0]?.stops.map((s) => s.stopId)).toEqual(['S1', 'S2']);
  });

  it('getRouteDirections returns empty for unknown route', async () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    const directions = await repo.getRouteDirections('nope');
    expect(directions).toEqual([]);
  });

  it('findNearbyStops returns the top-N sorted by distance', async () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    const nearby = await repo.findNearbyStops(
      { lat: 33.7540, lng: -84.3915 },
      2,
    );
    expect(nearby).toHaveLength(2);
    expect(nearby[0]?.stopId).toBe('S1');
    expect(nearby[1]?.stopId).toBe('S2');
    expect(nearby[0]?.distanceMeters).toBeLessThan(nearby[1]?.distanceMeters ?? Infinity);
  });

  it('findNearbyStops clamps count to 0', async () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    expect(await repo.findNearbyStops({ lat: 0, lng: 0 }, 0)).toEqual([]);
  });

  it('getStopsForTrip returns the trip’s ordered stop pattern', async () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    const stops = await repo.getStopsForTrip('T1');
    expect(stops).toEqual([
      { stopId: 'S1', stopSequence: 1 },
      { stopId: 'S2', stopSequence: 2 },
    ]);
  });

  it('getStopsForTrip returns empty for an unknown trip', async () => {
    const repo = new InMemoryGtfsRepository(BUNDLE);
    expect(await repo.getStopsForTrip('nope')).toEqual([]);
  });
});

describe('InMemoryGtfsRepository — sync contract', () => {
  it('sync methods do not return Promises (they are not async)', () => {
    // Pivotability claim from the interface: sync methods must NOT
    // be async. If a future implementation tries to make them async,
    // this test forces an interface change conversation rather than
    // letting it sneak through.
    const repo = new InMemoryGtfsRepository(BUNDLE);
    expect(repo.getStop('S1')).not.toBeInstanceOf(Promise);
    expect(repo.getRoute('116')).not.toBeInstanceOf(Promise);
    expect(repo.listStops()).not.toBeInstanceOf(Promise);
    expect(repo.listRoutes()).not.toBeInstanceOf(Promise);
  });
});
