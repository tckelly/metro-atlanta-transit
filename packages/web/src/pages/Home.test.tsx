/**
 * Behavior tests for `Home` — focused on the global stop-search box.
 *
 * Empty query leaves the existing favorites/nearby/browse-routes content
 * intact. A non-empty query replaces the body with a ranked results list,
 * each row showing stop name + the routes serving that stop. Clearing
 * the query restores the original content.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { Home } from './Home';
import { GtfsRepositoryProvider } from '../services/gtfs/GtfsRepositoryContext';
import {
  RealtimeFeedContext,
  type RealtimeFeedSnapshot,
} from '../features/realtime/RealtimeFeedContext';
import { FavoritesProvider } from '../features/favorites/FavoritesContext';
import { ToastProvider } from '../features/toast/ToastContext';
import { SettingsProvider } from '../features/settings/SettingsContext';
import type { GtfsRepository } from '../services/gtfs/GtfsRepository';
import type { RouteOut, StopOut } from '../buildtime/preprocessGtfs';
import {
  FAVORITES_STORAGE_KEY,
  type Favorite,
  type FavoritesStorage,
} from '../services/storage';

function memoryStorage(): {
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

const STOPS: StopOut[] = [
  { stopId: '1', name: 'Ponce de Leon Ave @ Barnett St', lat: 0, lng: 0, routeIds: ['2', '102'], directions: [{ routeId: '2', headsign: 'Midtown' }] },
  { stopId: '2', name: 'Memorial Dr SE @ Hill St', lat: 0, lng: 0, routeIds: ['21'], directions: [] },
  { stopId: '3', name: 'Peachtree St NW @ 14th St', lat: 0, lng: 0, routeIds: ['110'], directions: [] },
  { stopId: '4', name: 'Cherokee Ave @ Ponce Pl', lat: 0, lng: 0, routeIds: ['97'], directions: [] },
  { stopId: '5', name: 'Sponcetown Rd @ Old Mill Ln', lat: 0, lng: 0, routeIds: ['180'], directions: [] },
];

const ROUTES: RouteOut[] = [
  { routeId: '2', shortName: '2', longName: 'Ponce' },
  { routeId: '21', shortName: '21', longName: 'Memorial' },
  { routeId: '97', shortName: '97', longName: 'Cherokee' },
  { routeId: '102', shortName: '102', longName: 'Ponce Express' },
  { routeId: '110', shortName: '110', longName: 'Peachtree' },
  { routeId: '180', shortName: '180', longName: 'Spence' },
];

function searchRepo(): GtfsRepository {
  return {
    getStop: (id) => STOPS.find((s) => s.stopId === id),
    getRoute: (id) => ROUTES.find((r) => r.routeId === id),
    listStops: () => STOPS,
    listRoutes: () => ROUTES,
    getScheduledVisitsForStop: () => Promise.resolve([]),
    getRouteDirections: () => Promise.resolve([]),
    findNearbyStops: () => Promise.resolve([]),
    getStopsForTrip: () => Promise.resolve([]),
  };
}

function feed(): RealtimeFeedSnapshot {
  return {
    status: 'loading',
    tripUpdates: [],
    vehiclePositions: [],
    lastUpdated: null,
    isStale: false,
    error: null,
    refresh: vi.fn(async () => {}),
  };
}

function renderHome(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <SettingsProvider storage={memoryStorage()}>
        <ToastProvider>
          <FavoritesProvider storage={memoryStorage()}>
            <GtfsRepositoryProvider repository={searchRepo()}>
              <RealtimeFeedContext.Provider value={feed()}>
                <Home />
              </RealtimeFeedContext.Provider>
            </GtfsRepositoryProvider>
          </FavoritesProvider>
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe('Home — global stop search', () => {
  it('links to the rail stations directory', () => {
    renderHome();
    const link = screen.getByRole('link', { name: /rail stations/i });
    expect(link).toHaveAttribute('href', '/stations');
  });

  it('renders the normal home content when the query is empty', () => {
    renderHome();
    // Favorites heading is the canonical signal that the default home renders.
    expect(screen.getByRole('heading', { name: /my stops/i })).toBeInTheDocument();
    // No stop rows from the search corpus appear when the query is empty.
    expect(screen.queryByText('Ponce de Leon Ave @ Barnett St')).not.toBeInTheDocument();
  });

  it('typing in the search box shows ranked stop results', async () => {
    renderHome();
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'ponce');

    // Two prefix matches outrank the word-boundary match and the substring match.
    const items = screen.getAllByRole('link', { name: /ponce|cherokee|sponcetown/i });
    const names = items.map((el) => el.textContent);
    expect(names[0]).toContain('Ponce de Leon Ave @ Barnett St');
    // The substring-only match (Sponcetown) ranks last among matches.
    expect(names[names.length - 1]).toContain('Sponcetown');
  });

  it('shows the direction disambiguator (route → headsign) for each result stop', async () => {
    renderHome();
    await userEvent.type(screen.getByRole('searchbox'), 'ponce');
    // "Ponce de Leon …" serves route 2 toward Midtown. Sighted users see the
    // glyph form; the link exposes a spoken form since "→" reads inconsistently.
    expect(screen.getByText('2 → Midtown')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /Ponce de Leon Ave @ Barnett St.*Route 2 toward Midtown/,
      }),
    ).toBeInTheDocument();
  });

  it('shows an empty-state when no stops match', async () => {
    renderHome();
    await userEvent.type(screen.getByRole('searchbox'), 'xyz-nothing-matches');
    expect(screen.getByText(/no matching stops/i)).toBeInTheDocument();
  });

  it('clearing the search restores the normal home content', async () => {
    renderHome();
    await userEvent.type(screen.getByRole('searchbox'), 'ponce');
    expect(screen.getByText('Ponce de Leon Ave @ Barnett St')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.queryByText('Ponce de Leon Ave @ Barnett St')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /my stops/i })).toBeInTheDocument();
  });

  it('result rows link to /stop/:stopId', async () => {
    renderHome();
    await userEvent.type(screen.getByRole('searchbox'), 'memorial');
    const link = screen.getByRole('link', { name: /Memorial Dr SE @ Hill St/ });
    expect(link).toHaveAttribute('href', '/stop/2');
  });
});

function seededStorage(initial: Favorite[]): FavoritesStorage {
  const map = new Map<string, string>();
  if (initial.length > 0) {
    map.set(FAVORITES_STORAGE_KEY, JSON.stringify(initial));
  }
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

function renderHomeWithFavorites(favorites: Favorite[]): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <SettingsProvider storage={memoryStorage()}>
        <ToastProvider>
          <FavoritesProvider storage={seededStorage(favorites)}>
            <GtfsRepositoryProvider repository={searchRepo()}>
              <RealtimeFeedContext.Provider value={feed()}>
                <Home />
              </RealtimeFeedContext.Provider>
            </GtfsRepositoryProvider>
          </FavoritesProvider>
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe('Home — reorder favorites', () => {
  it('hides the Reorder toggle when there are fewer than 2 favorites', () => {
    renderHomeWithFavorites([{ stopId: '1', addedAt: 1 }]);
    expect(screen.queryByRole('button', { name: /reorder/i })).not.toBeInTheDocument();
  });

  it('shows the Reorder toggle when there are 2+ favorites', () => {
    renderHomeWithFavorites([
      { stopId: '1', addedAt: 1 },
      { stopId: '2', addedAt: 2 },
    ]);
    expect(screen.getByRole('button', { name: /reorder/i })).toBeInTheDocument();
  });

  it('entering reorder mode swaps card links for move buttons; Done exits', async () => {
    renderHomeWithFavorites([
      { stopId: '1', addedAt: 1 },
      { stopId: '2', addedAt: 2 },
    ]);
    // Browse mode: each favorite card is a link.
    expect(screen.getByRole('link', { name: /Ponce de Leon Ave/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /reorder/i }));

    // Reorder mode: links gone, move buttons present, toggle label flips to "Done".
    expect(screen.queryByRole('link', { name: /Ponce de Leon Ave/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Move Ponce de Leon Ave @ Barnett St down/ }),
    ).toBeInTheDocument();
    const doneButton = screen.getByRole('button', { name: /^done$/i });
    expect(doneButton).toBeInTheDocument();

    await userEvent.click(doneButton);

    // Back to browse mode.
    expect(screen.getByRole('link', { name: /Ponce de Leon Ave/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reorder/i })).toBeInTheDocument();
  });

  it('clicking move-down on the first favorite swaps it with the second', async () => {
    renderHomeWithFavorites([
      { stopId: '1', addedAt: 1 }, // Ponce de Leon …
      { stopId: '2', addedAt: 2 }, // Memorial Dr …
    ]);
    await userEvent.click(screen.getByRole('button', { name: /reorder/i }));

    const list = screen.getByRole('list', { name: /my stops/i });
    const beforeNames = Array.from(list.querySelectorAll('li')).map((li) => li.textContent);
    expect(beforeNames[0]).toContain('Ponce de Leon Ave');
    expect(beforeNames[1]).toContain('Memorial Dr');

    await userEvent.click(
      screen.getByRole('button', { name: /Move Ponce de Leon Ave @ Barnett St down/ }),
    );

    const afterNames = Array.from(list.querySelectorAll('li')).map((li) => li.textContent);
    expect(afterNames[0]).toContain('Memorial Dr');
    expect(afterNames[1]).toContain('Ponce de Leon Ave');
  });

  it('disables move-up on the first card and move-down on the last card', async () => {
    renderHomeWithFavorites([
      { stopId: '1', addedAt: 1 },
      { stopId: '2', addedAt: 2 },
      { stopId: '3', addedAt: 3 },
    ]);
    await userEvent.click(screen.getByRole('button', { name: /reorder/i }));

    expect(
      screen.getByRole('button', { name: /Move Ponce de Leon Ave @ Barnett St up/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Move Peachtree St NW @ 14th St down/ }),
    ).toBeDisabled();
    // Middle card has both directions enabled.
    expect(
      screen.getByRole('button', { name: /Move Memorial Dr SE @ Hill St up/ }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Move Memorial Dr SE @ Hill St down/ }),
    ).not.toBeDisabled();
  });

  it('announces the move in an sr-only polite live region with stop name + position', async () => {
    renderHomeWithFavorites([
      { stopId: '1', addedAt: 1 },
      { stopId: '2', addedAt: 2 },
      { stopId: '3', addedAt: 3 },
    ]);
    await userEvent.click(screen.getByRole('button', { name: /reorder/i }));

    // status role is one canonical way to expose aria-live=polite to AT.
    const liveRegion = screen.getByRole('status', { name: /reorder announcements/i });
    expect(liveRegion).toBeEmptyDOMElement();

    await userEvent.click(
      screen.getByRole('button', { name: /Move Memorial Dr SE @ Hill St down/ }),
    );

    expect(liveRegion).toHaveTextContent(/Memorial Dr SE @ Hill St moved to position 3 of 3/);
  });
});
