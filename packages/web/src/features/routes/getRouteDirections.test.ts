import { describe, it, expect } from 'vitest';

import { getRouteDirections } from './getRouteDirections';
import type { GtfsBundle, StopOut } from '../../buildtime/preprocessGtfs';

const STOPS: StopOut[] = [
  { stopId: 'S1', name: 'Stop 1', lat: 0, lng: 0, routeIds: ['116'], directions: [] },
  { stopId: 'S2', name: 'Stop 2', lat: 0, lng: 0, routeIds: ['116'], directions: [] },
  { stopId: 'S3', name: 'Stop 3', lat: 0, lng: 0, routeIds: ['116'], directions: [] },
  { stopId: 'S4', name: 'Stop 4', lat: 0, lng: 0, routeIds: ['116'], directions: [] },
  { stopId: 'S5', name: 'Stop 5', lat: 0, lng: 0, routeIds: ['999'], directions: [] },
];

const BASE_BUNDLE: GtfsBundle = {
  stops: STOPS,
  routes: [{ routeId: '116', shortName: '116', longName: 'Test Route' }],
  trips: [
    { tripId: 'TA1', routeId: '116', serviceId: 'WK', headsign: 'Decatur' },
    { tripId: 'TA2', routeId: '116', serviceId: 'WK', headsign: 'Decatur' }, // short variant
    { tripId: 'TB1', routeId: '116', serviceId: 'WK', headsign: 'Avondale' },
    { tripId: 'TX1', routeId: '999', serviceId: 'WK', headsign: 'Other' },
  ],
  stopTimes: [
    // TA1: full Decatur pattern S1 → S2 → S3
    { tripId: 'TA1', stopId: 'S1', stopSequence: 1, arrivalTime: '06:00:00', departureTime: '06:00:00' },
    { tripId: 'TA1', stopId: 'S2', stopSequence: 2, arrivalTime: '06:05:00', departureTime: '06:05:00' },
    { tripId: 'TA1', stopId: 'S3', stopSequence: 3, arrivalTime: '06:10:00', departureTime: '06:10:00' },
    // TA2: short Decatur pattern S2 → S3 (turns mid-route)
    { tripId: 'TA2', stopId: 'S2', stopSequence: 1, arrivalTime: '07:00:00', departureTime: '07:00:00' },
    { tripId: 'TA2', stopId: 'S3', stopSequence: 2, arrivalTime: '07:05:00', departureTime: '07:05:00' },
    // TB1: Avondale pattern S3 → S2 → S1 → S4
    { tripId: 'TB1', stopId: 'S3', stopSequence: 1, arrivalTime: '06:00:00', departureTime: '06:00:00' },
    { tripId: 'TB1', stopId: 'S2', stopSequence: 2, arrivalTime: '06:05:00', departureTime: '06:05:00' },
    { tripId: 'TB1', stopId: 'S1', stopSequence: 3, arrivalTime: '06:10:00', departureTime: '06:10:00' },
    { tripId: 'TB1', stopId: 'S4', stopSequence: 4, arrivalTime: '06:15:00', departureTime: '06:15:00' },
    // TX1: different route — must be ignored
    { tripId: 'TX1', stopId: 'S5', stopSequence: 1, arrivalTime: '06:00:00', departureTime: '06:00:00' },
  ],
  calendar: { rules: [], exceptions: [] },
};

describe('getRouteDirections', () => {
  it('returns one entry per unique headsign for the route', () => {
    const dirs = getRouteDirections(BASE_BUNDLE, '116');
    const headsigns = dirs.map((d) => d.headsign).sort();
    expect(headsigns).toEqual(['Avondale', 'Decatur']);
  });

  it('picks the trip with the longest stop list as the canonical pattern', () => {
    // TA1 has 3 stops, TA2 has 2 — Decatur should follow TA1's pattern.
    const dirs = getRouteDirections(BASE_BUNDLE, '116');
    const decatur = dirs.find((d) => d.headsign === 'Decatur');
    expect(decatur?.stops.map((s) => s.stopId)).toEqual(['S1', 'S2', 'S3']);
  });

  it('orders stops by stop_sequence ascending', () => {
    const dirs = getRouteDirections(BASE_BUNDLE, '116');
    const avondale = dirs.find((d) => d.headsign === 'Avondale');
    expect(avondale?.stops.map((s) => s.stopId)).toEqual(['S3', 'S2', 'S1', 'S4']);
  });

  it('ignores trips on other routes', () => {
    const dirs = getRouteDirections(BASE_BUNDLE, '116');
    const allStopIds = new Set(dirs.flatMap((d) => d.stops.map((s) => s.stopId)));
    expect(allStopIds.has('S5')).toBe(false);
  });

  it('returns an empty array for an unknown routeId', () => {
    expect(getRouteDirections(BASE_BUNDLE, 'nonexistent')).toEqual([]);
  });

  it('drops stop_time rows that reference a missing stop', () => {
    const bundle: GtfsBundle = {
      ...BASE_BUNDLE,
      stops: BASE_BUNDLE.stops.filter((s) => s.stopId !== 'S2'),
    };
    const decatur = getRouteDirections(bundle, '116').find((d) => d.headsign === 'Decatur');
    expect(decatur?.stops.map((s) => s.stopId)).toEqual(['S1', 'S3']);
  });
});
