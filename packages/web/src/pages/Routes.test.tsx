/**
 * Behavior tests for the all-routes browse page.
 *
 * Adds the same search affordance as RouteDetail (per-route stop
 * filter) and Home (global stop search), but scoped to the route list
 * — filter in place, preserve natural-sort order, no ranking. The
 * predicate matches against both the route's short name (number) and
 * its long name (street).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { Routes } from './Routes';
import { GtfsRepositoryProvider } from '../services/gtfs/GtfsRepositoryContext';
import type { GtfsRepository } from '../services/gtfs/GtfsRepository';
import type { RouteOut } from '../buildtime/preprocessGtfs';

const ROUTES: RouteOut[] = [
  { routeId: 'r1', shortName: '1', longName: 'Joseph E. Lowery Blvd / 17th St' },
  { routeId: 'r2', shortName: '2', longName: 'Ponce de Leon Ave' },
  { routeId: 'r4', shortName: '4', longName: 'Moreland Avenue' },
  { routeId: 'r11', shortName: '11', longName: 'Defoor Ave / Virginia Highland' },
  { routeId: 'r21', shortName: '21', longName: 'Memorial Drive ITP' },
  { routeId: 'r110', shortName: '110', longName: 'Peachtree' },
];

function routesRepo(): GtfsRepository {
  return {
    getStop: () => undefined,
    getRoute: (id) => ROUTES.find((r) => r.routeId === id),
    listStops: () => [],
    listRoutes: () => ROUTES,
    getScheduledVisitsForStop: () => Promise.resolve([]),
    getRouteDirections: () => Promise.resolve([]),
    findNearbyStops: () => Promise.resolve([]),
    getStopsForTrip: () => Promise.resolve([]),
  };
}

function renderRoutes(): void {
  render(
    <MemoryRouter initialEntries={['/routes']}>
      <GtfsRepositoryProvider repository={routesRepo()}>
        <Routes />
      </GtfsRepositoryProvider>
    </MemoryRouter>,
  );
}

describe('Routes — search', () => {
  it('renders every route with an empty query', () => {
    renderRoutes();
    for (const route of ROUTES) {
      expect(screen.getByText(route.longName)).toBeInTheDocument();
    }
  });

  it('filters by short name (route number)', async () => {
    renderRoutes();
    await userEvent.type(screen.getByRole('searchbox'), '11');
    // Both "11" and "110" should match (substring on the number).
    expect(screen.getByText('Defoor Ave / Virginia Highland')).toBeInTheDocument();
    expect(screen.getByText('Peachtree')).toBeInTheDocument();
    // Unrelated routes are gone.
    expect(screen.queryByText('Ponce de Leon Ave')).not.toBeInTheDocument();
    expect(screen.queryByText('Moreland Avenue')).not.toBeInTheDocument();
  });

  it('filters by long name (street)', async () => {
    renderRoutes();
    await userEvent.type(screen.getByRole('searchbox'), 'ponce');
    expect(screen.getByText('Ponce de Leon Ave')).toBeInTheDocument();
    expect(screen.queryByText('Moreland Avenue')).not.toBeInTheDocument();
    expect(screen.queryByText('Memorial Drive ITP')).not.toBeInTheDocument();
  });

  it('preserves the natural-sort order of remaining routes', async () => {
    renderRoutes();
    await userEvent.type(screen.getByRole('searchbox'), 'a');
    // Every route whose long name contains "a" (case-insensitive).
    // Route "1" / "Joseph E. Lowery Blvd / 17th St" has none. The
    // remaining matches must come back in natural ascending order.
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    const numbers = items.map((li) => within(li).getAllByText(/^\d+$/)[0]?.textContent);
    expect(numbers).toEqual(['2', '4', '11', '21', '110']);
  });

  it('shows an empty-state message when nothing matches', async () => {
    renderRoutes();
    await userEvent.type(screen.getByRole('searchbox'), 'xyz-no-match');
    expect(screen.getByText(/no matching routes/i)).toBeInTheDocument();
    expect(screen.queryByText('Ponce de Leon Ave')).not.toBeInTheDocument();
  });

  it('clearing the search restores every route', async () => {
    renderRoutes();
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'ponce');
    expect(screen.queryByText('Moreland Avenue')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.getByText('Moreland Avenue')).toBeInTheDocument();
  });
});
