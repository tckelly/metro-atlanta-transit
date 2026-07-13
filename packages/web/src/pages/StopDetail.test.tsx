/**
 * Behavior tests for `StopDetail`.
 *
 * Focus: the failure path must not leak the raw error message from
 * the realtime feed (or the scheduled-visits fetch) into user-visible
 * UI. The leak surfaced because `MessageCard` body was wired to
 * `error?.message` — a developer-facing string with HTTP status text
 * and route-internal verbiage. Public users get a friendly fallback
 * instead; technical detail goes to the console for developers.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { StopDetail } from './StopDetail';
import { GtfsRepositoryProvider } from '../services/gtfs/GtfsRepositoryContext';
import {
  RealtimeFeedContext,
  type RealtimeFeedSnapshot,
} from '../features/realtime/RealtimeFeedContext';
import { FavoritesProvider } from '../features/favorites/FavoritesContext';
import { ToastProvider } from '../features/toast/ToastContext';
import { SettingsProvider } from '../features/settings/SettingsContext';
import type { GtfsRepository } from '../services/gtfs/GtfsRepository';

function noopStorage(): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
} {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

function staticRepo(): GtfsRepository {
  return {
    getStop: (id) => ({ stopId: id, name: 'Test Stop', lat: 0, lng: 0, routeIds: [], directions: [] }),
    getRoute: () => undefined,
    listStops: () => [],
    listRoutes: () => [],
    getScheduledVisitsForStop: () => Promise.resolve([]),
    getRouteDirections: () => Promise.resolve([]),
    findNearbyStops: () => Promise.resolve([]),
    getStopsForTrip: () => Promise.resolve([]),
  };
}

// Repo whose stop carries one direction, with the route present so
// routeId → shortName resolves. Exercises the header disambiguator line.
function directionsRepo(): GtfsRepository {
  return {
    ...staticRepo(),
    getStop: (id) => ({
      stopId: id,
      name: 'Virginia Ave @ Maryland Ave',
      lat: 0,
      lng: 0,
      routeIds: ['R11'],
      directions: [{ routeId: 'R11', headsign: 'Collier Rd' }],
    }),
    getRoute: (routeId) =>
      routeId === 'R11' ? { routeId: 'R11', shortName: '11', longName: 'Virginia Highland' } : undefined,
  };
}

function feedInError(error: Error): RealtimeFeedSnapshot {
  return {
    status: 'error',
    tripUpdates: [],
    vehiclePositions: [],
    lastUpdated: null,
    isStale: false,
    error,
    refresh: vi.fn(async () => {}),
  };
}

function renderStopDetail(
  stopId: string,
  feed: RealtimeFeedSnapshot,
  repo: GtfsRepository = staticRepo(),
): void {
  render(
    <MemoryRouter initialEntries={[`/stop/${stopId}`]}>
      <SettingsProvider storage={noopStorage()}>
        <ToastProvider>
          <FavoritesProvider storage={noopStorage()}>
            <GtfsRepositoryProvider repository={repo}>
              <RealtimeFeedContext.Provider value={feed}>
                <Routes>
                  <Route path="/stop/:stopId" element={<StopDetail />} />
                </Routes>
              </RealtimeFeedContext.Provider>
            </GtfsRepositoryProvider>
          </FavoritesProvider>
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe('StopDetail — error UX', () => {
  it('shows a friendly fallback body and does not leak the raw error', () => {
    const leak = 'MARTA fetch failed: 502 Bad Gateway (https://gtfs-rt.itsmarta.com/…)';
    renderStopDetail('902990', feedInError(new Error(leak)));

    expect(screen.getByText(/couldn[’']t load arrivals/i)).toBeInTheDocument();

    expect(screen.queryByText(leak)).not.toBeInTheDocument();
    expect(screen.queryByText(/502/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gtfs-rt\.itsmarta\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/MARTA fetch failed/i)).not.toBeInTheDocument();

    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });
});

describe('StopDetail — header direction disambiguator', () => {
  it('shows a route → headsign line under the stop name with a spoken accessible name', () => {
    // The header renders regardless of feed status; an error feed is fine here.
    renderStopDetail('904257', feedInError(new Error('ignored')), directionsRepo());

    const line = screen.getByText('11 → Collier Rd');
    expect(line).toBeInTheDocument();
    // "→" is not voiced; the element exposes the spoken form instead.
    expect(line).toHaveAccessibleName('Route 11 toward Collier Rd');
  });
});
