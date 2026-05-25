import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import { FavoritesProvider, useFavorites } from './FavoritesContext';
import {
  FAVORITES_STORAGE_KEY,
  MAX_FAVORITES,
  type Favorite,
  type FavoritesStorage,
} from '../../services/storage';

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

function wrapperWith(storage: FavoritesStorage) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <FavoritesProvider storage={storage}>{children}</FavoritesProvider>;
  };
}

const FIXED_NOW_MS = 1_700_000_000_000;
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW_MS));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FavoritesContext', () => {
  it('loads existing favorites from storage on mount', () => {
    const seed: Favorite[] = [{ stopId: '902990', addedAt: 1 }];
    const storage = makeMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify(seed),
    });

    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperWith(storage),
    });

    expect(result.current.favorites).toEqual(seed);
    expect(result.current.has('902990')).toBe(true);
    expect(result.current.has('other')).toBe(false);
  });

  it('starts empty when storage has no value', () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperWith(makeMemoryStorage()),
    });
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFull).toBe(false);
  });

  it('add() appends a favorite with addedAt = now (unix seconds) and persists', () => {
    const storage = makeMemoryStorage();
    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperWith(storage),
    });

    act(() => {
      const ok = result.current.add('902990');
      expect(ok).toBe(true);
    });

    expect(result.current.favorites).toEqual([
      { stopId: '902990', addedAt: FIXED_NOW_SEC },
    ]);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBe(
      JSON.stringify([{ stopId: '902990', addedAt: FIXED_NOW_SEC }]),
    );
  });

  it('add() is a no-op for a stop already favorited (returns true, no duplicate)', () => {
    const seed: Favorite[] = [{ stopId: '902990', addedAt: 1 }];
    const storage = makeMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify(seed),
    });
    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperWith(storage),
    });

    act(() => {
      const ok = result.current.add('902990');
      expect(ok).toBe(true);
    });

    expect(result.current.favorites).toEqual(seed);
  });

  it('add() refuses when the list is at MAX_FAVORITES, returning false', () => {
    const full: Favorite[] = Array.from({ length: MAX_FAVORITES }, (_, i) => ({
      stopId: `stop-${i}`,
      addedAt: i,
    }));
    const storage = makeMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify(full),
    });
    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperWith(storage),
    });

    expect(result.current.isFull).toBe(true);

    act(() => {
      const ok = result.current.add('one-too-many');
      expect(ok).toBe(false);
    });

    expect(result.current.favorites).toHaveLength(MAX_FAVORITES);
    expect(result.current.has('one-too-many')).toBe(false);
  });

  it('remove() removes the matching favorite and persists', () => {
    const seed: Favorite[] = [
      { stopId: 'a', addedAt: 1 },
      { stopId: 'b', addedAt: 2 },
    ];
    const storage = makeMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify(seed),
    });
    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperWith(storage),
    });

    act(() => {
      result.current.remove('a');
    });

    expect(result.current.favorites).toEqual([{ stopId: 'b', addedAt: 2 }]);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBe(
      JSON.stringify([{ stopId: 'b', addedAt: 2 }]),
    );
  });

  it('remove() is a no-op for a stopId that is not favorited', () => {
    const seed: Favorite[] = [{ stopId: 'a', addedAt: 1 }];
    const storage = makeMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify(seed),
    });
    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperWith(storage),
    });

    act(() => {
      result.current.remove('nope');
    });

    expect(result.current.favorites).toEqual(seed);
  });

  it('remove() of the last favorite clears the storage key', () => {
    const seed: Favorite[] = [{ stopId: 'a', addedAt: 1 }];
    const storage = makeMemoryStorage({
      [FAVORITES_STORAGE_KEY]: JSON.stringify(seed),
    });
    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperWith(storage),
    });

    act(() => {
      result.current.remove('a');
    });

    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBeNull();
  });

  it('throws when useFavorites is called outside the provider', () => {
    // Suppress the React error-boundary warning that renderHook would log.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useFavorites())).toThrow(/FavoritesProvider/);
    spy.mockRestore();
  });
});
