/**
 * Behavior tests for `RouteDetail`.
 *
 * Focus: the failure path must not leak the raw error message from
 * the data layer into user-visible UI. Previously the `MessageCard`
 * body rendered `state.message` verbatim, so a 500 from the dev
 * middleware or a future production failure would surface strings
 * like "route-directions failed: 500 Internal Server Error" — both
 * meaningless to a user and a small information-disclosure smell on
 * a public site.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { RouteDetail } from './RouteDetail';
import { GtfsRepositoryProvider } from '../services/gtfs/GtfsRepositoryContext';
import type { GtfsRepository } from '../services/gtfs/GtfsRepository';
import type { StopOut } from '../buildtime/preprocessGtfs';
import type { RouteDirection } from '../features/routes/getRouteDirections';

function failingRepo(error: Error): GtfsRepository {
  return {
    getStop: () => undefined,
    getRoute: (id) => ({ routeId: id, shortName: id, longName: 'Moreland Avenue' }),
    listStops: () => [],
    listRoutes: () => [],
    getScheduledVisitsForStop: () => Promise.reject(error),
    getRouteDirections: () => Promise.reject(error),
    findNearbyStops: () => Promise.resolve([]),
    getStopsForTrip: () => Promise.resolve([]),
  };
}

function renderAt(routeId: string, repo: GtfsRepository): void {
  render(
    <MemoryRouter initialEntries={[`/route/${routeId}`]}>
      <GtfsRepositoryProvider repository={repo}>
        <Routes>
          <Route path="/route/:routeId" element={<RouteDetail />} />
        </Routes>
      </GtfsRepositoryProvider>
    </MemoryRouter>,
  );
}

function stop(id: string, name: string): StopOut {
  return { stopId: id, name, lat: 0, lng: 0, routeIds: ['4'] };
}

function directionsRepo(directions: RouteDirection[]): GtfsRepository {
  return {
    getStop: () => undefined,
    getRoute: (id) => ({ routeId: id, shortName: id, longName: 'Moreland Avenue' }),
    listStops: () => [],
    listRoutes: () => [],
    getScheduledVisitsForStop: () => Promise.resolve([]),
    getRouteDirections: () => Promise.resolve(directions),
    findNearbyStops: () => Promise.resolve([]),
    getStopsForTrip: () => Promise.resolve([]),
  };
}

describe('RouteDetail — per-route stop filter', () => {
  const DIRECTIONS: RouteDirection[] = [
    {
      headsign: 'Northbound',
      stops: [
        stop('1', 'Ponce de Leon Ave @ Barnett St'),
        stop('2', 'Memorial Dr SE @ Hill St'),
        stop('3', 'Peachtree St NW @ 14th St'),
      ],
    },
    {
      headsign: 'Southbound',
      stops: [
        stop('4', 'Cherokee Ave @ Ponce Pl'),
        stop('5', 'Boulevard SE @ Glenwood Ave'),
      ],
    },
  ];

  it('renders every stop with an empty query', async () => {
    renderAt('4', directionsRepo(DIRECTIONS));
    expect(await screen.findByText('Ponce de Leon Ave @ Barnett St')).toBeInTheDocument();
    expect(screen.getByText('Memorial Dr SE @ Hill St')).toBeInTheDocument();
    expect(screen.getByText('Peachtree St NW @ 14th St')).toBeInTheDocument();
    expect(screen.getByText('Cherokee Ave @ Ponce Pl')).toBeInTheDocument();
    expect(screen.getByText('Boulevard SE @ Glenwood Ave')).toBeInTheDocument();
  });

  it('typing in the search box filters stops across all directions', async () => {
    renderAt('4', directionsRepo(DIRECTIONS));
    await screen.findByText('Ponce de Leon Ave @ Barnett St');

    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'ponce');

    expect(screen.getByText('Ponce de Leon Ave @ Barnett St')).toBeInTheDocument();
    expect(screen.getByText('Cherokee Ave @ Ponce Pl')).toBeInTheDocument();
    expect(screen.queryByText('Memorial Dr SE @ Hill St')).not.toBeInTheDocument();
    expect(screen.queryByText('Peachtree St NW @ 14th St')).not.toBeInTheDocument();
  });

  it('shows an empty-state message when no stops match', async () => {
    renderAt('4', directionsRepo(DIRECTIONS));
    await screen.findByText('Ponce de Leon Ave @ Barnett St');

    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'xyz-no-match');

    expect(screen.getByText(/no matching stops/i)).toBeInTheDocument();
    expect(screen.queryByText('Ponce de Leon Ave @ Barnett St')).not.toBeInTheDocument();
  });

  it('clearing the search restores every stop', async () => {
    renderAt('4', directionsRepo(DIRECTIONS));
    await screen.findByText('Ponce de Leon Ave @ Barnett St');

    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'ponce');
    expect(screen.queryByText('Memorial Dr SE @ Hill St')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.getByText('Memorial Dr SE @ Hill St')).toBeInTheDocument();
  });
});

describe('RouteDetail — error UX', () => {
  it('shows a friendly fallback body and does not leak the raw error', async () => {
    const leak = 'route-directions failed: 500 Internal Server Error';
    renderAt('4', failingRepo(new Error(leak)));

    // The error card renders (title is the existing friendly title).
    expect(await screen.findByText(/couldn[’']t load route data/i)).toBeInTheDocument();

    // The raw, leaky strings must NOT reach the DOM.
    expect(screen.queryByText(leak)).not.toBeInTheDocument();
    expect(screen.queryByText(/500/)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal server error/i)).not.toBeInTheDocument();

    // A user-facing fallback is shown.
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });
});
