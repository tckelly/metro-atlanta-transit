/**
 * Shared scaffolding for the vitest-axe accessibility tests.
 *
 * Composes the standard provider tree (i18n, settings, favorites,
 * GTFS repo, router, realtime feed) with fake data so a page renders
 * end-to-end without touching the network. Tests then call
 * `axe(container)` to scan the rendered DOM for ARIA / semantic /
 * label issues.
 *
 * Why all in one helper: an a11y test that has to set up six
 * providers per file would drown out the actual assertion. Co-locating
 * the harness here keeps the per-page tests one-liners.
 *
 * See `test-setup.ts` for the matcher registration and the jsdom
 * caveat (no color-contrast checks at this layer).
 */
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { FavoritesProvider } from '../features/favorites/FavoritesContext';
import {
  RealtimeFeedContext,
  type RealtimeFeedSnapshot,
} from '../features/realtime/RealtimeFeedContext';
import { SettingsProvider } from '../features/settings/SettingsContext';
import { ToastProvider } from '../features/toast/ToastContext';
import { GtfsRepositoryProvider } from '../services/gtfs/GtfsRepositoryContext';
import { InMemoryGtfsRepository } from '../services/gtfs/InMemoryGtfsRepository';
import type { GtfsBundle, StopOut, RouteOut } from '../buildtime/preprocessGtfs';
import type { FavoritesStorage } from '../services/storage';
import type { SettingsStorage } from '../features/settings/SettingsContext';

interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function makeMemoryStorage(seed: Record<string, string> = {}): MemoryStorage {
  const map = new Map<string, string>(Object.entries(seed));
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

const DEFAULT_STOPS: StopOut[] = [
  { stopId: '902990', name: 'Virginia Ave @ Todd Rd',     lat: 33.754, lng: -84.391, routeIds: ['116'], directions: [] },
  { stopId: '904428', name: 'Ponce de Leon @ Barnett St', lat: 33.770, lng: -84.380, routeIds: ['2'], directions: [] },
];

const DEFAULT_ROUTES: RouteOut[] = [
  { routeId: '116', shortName: '116', longName: 'Decatur via Avondale' },
  { routeId: '2',   shortName: '2',   longName: 'Ponce de Leon Ave' },
];

function defaultBundle(): GtfsBundle {
  return {
    stops: DEFAULT_STOPS,
    routes: DEFAULT_ROUTES,
    trips: [],
    stopTimes: [],
    calendar: { rules: [], exceptions: [] },
  };
}

function defaultFeedSnapshot(): RealtimeFeedSnapshot {
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

export interface RenderForA11yOptions {
  /** Initial route. Defaults to "/". */
  route?: string;
  /** Bundle the GtfsRepository sees. Defaults to a small Atlanta fixture. */
  bundle?: GtfsBundle;
  /** Seeded localStorage for FavoritesProvider. */
  favoritesStorage?: FavoritesStorage;
  /** Seeded localStorage for SettingsProvider. */
  settingsStorage?: SettingsStorage;
  /** Realtime feed snapshot. Defaults to a loading state. */
  feed?: RealtimeFeedSnapshot;
}

/**
 * Render a UI tree inside the full provider stack a real page sees,
 * with synthetic in-memory data so nothing hits the network.
 */
export function renderForA11y(ui: ReactNode, options: RenderForA11yOptions = {}): RenderResult {
  const repository = new InMemoryGtfsRepository(options.bundle ?? defaultBundle());
  const favoritesStorage = options.favoritesStorage ?? makeMemoryStorage();
  const settingsStorage = options.settingsStorage ?? makeMemoryStorage();
  const feed = options.feed ?? defaultFeedSnapshot();

  return render(
    <MemoryRouter initialEntries={[options.route ?? '/']}>
      <SettingsProvider storage={settingsStorage}>
        <ToastProvider>
          <FavoritesProvider storage={favoritesStorage}>
            <GtfsRepositoryProvider repository={repository}>
              <RealtimeFeedContext.Provider value={feed}>{ui}</RealtimeFeedContext.Provider>
            </GtfsRepositoryProvider>
          </FavoritesProvider>
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}
