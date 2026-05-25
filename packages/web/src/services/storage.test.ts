import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  loadFavorites,
  saveFavorites,
  FAVORITES_STORAGE_KEY,
  MAX_FAVORITES,
  type Favorite,
  type FavoritesStorage,
} from './storage';

// In-memory Storage stand-in: lets each test start from a clean slate
// without coupling to jsdom's shared `window.localStorage`. The contract
// matches the Web Storage API surface we actually use.
function makeMemoryStorage(seed: Record<string, string> = {}): FavoritesStorage {
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

describe('loadFavorites', () => {
  it('returns an empty array when no value is stored', () => {
    const storage = makeMemoryStorage();
    expect(loadFavorites(storage)).toEqual([]);
  });

  it('returns the parsed favorites when the stored value is valid', () => {
    const stored: Favorite[] = [
      { stopId: '902990', addedAt: 1700000000 },
      { stopId: '904428', addedAt: 1700000100 },
    ];
    const storage = makeMemoryStorage({ [FAVORITES_STORAGE_KEY]: JSON.stringify(stored) });
    expect(loadFavorites(storage)).toEqual(stored);
  });

  it('returns an empty array when stored JSON is malformed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = makeMemoryStorage({ [FAVORITES_STORAGE_KEY]: '{not-json' });
    expect(loadFavorites(storage)).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('returns an empty array when stored shape fails validation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Each object is missing `addedAt` — Zod must reject the entire payload.
    const bad = JSON.stringify([{ stopId: '902990' }]);
    const storage = makeMemoryStorage({ [FAVORITES_STORAGE_KEY]: bad });
    expect(loadFavorites(storage)).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('returns an empty array when stored value is not an array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = makeMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify({ stopId: '902990', addedAt: 1 }),
    });
    expect(loadFavorites(storage)).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});

describe('saveFavorites', () => {
  it('serializes favorites to the canonical storage key', () => {
    const storage = makeMemoryStorage();
    const favs: Favorite[] = [{ stopId: '902990', addedAt: 1700000000 }];
    saveFavorites(favs, storage);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBe(JSON.stringify(favs));
  });

  it('overwrites previous favorites', () => {
    const storage = makeMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify([{ stopId: 'old', addedAt: 1 }]),
    });
    const next: Favorite[] = [{ stopId: '902990', addedAt: 1700000000 }];
    saveFavorites(next, storage);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBe(JSON.stringify(next));
  });

  it('removes the stored value when given an empty list', () => {
    const storage = makeMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify([{ stopId: 'x', addedAt: 1 }]),
    });
    saveFavorites([], storage);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBeNull();
  });

  it('throws when given more than the maximum allowed favorites', () => {
    const storage = makeMemoryStorage();
    const tooMany: Favorite[] = Array.from({ length: MAX_FAVORITES + 1 }, (_, i) => ({
      stopId: `s${i}`,
      addedAt: i,
    }));
    expect(() => saveFavorites(tooMany, storage)).toThrow(/max/i);
  });

  it('round-trips: load(save(x)) === x', () => {
    const storage = makeMemoryStorage();
    const favs: Favorite[] = [
      { stopId: '902990', addedAt: 1700000000 },
      { stopId: '904428', addedAt: 1700000100 },
    ];
    saveFavorites(favs, storage);
    expect(loadFavorites(storage)).toEqual(favs);
  });
});

describe('MAX_FAVORITES', () => {
  it('is 10 per product requirement', () => {
    expect(MAX_FAVORITES).toBe(10);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
