/**
 * Single source of truth for the user's favorite stops.
 *
 * The provider loads from storage once on mount and writes through on
 * every mutation. State lives in React; storage is just persistence.
 * Storage is injectable so tests can pass an in-memory implementation.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  loadFavorites,
  saveFavorites,
  MAX_FAVORITES,
  type Favorite,
  type FavoritesStorage,
} from '../../services/storage';

export interface FavoritesContextValue {
  favorites: Favorite[];
  /** True iff `favorites.length === MAX_FAVORITES`. */
  isFull: boolean;
  /**
   * Add a stop to favorites. Returns false (and changes nothing) when at
   * the cap. Adding an already-favorited stop is a successful no-op.
   */
  add: (stopId: string) => boolean;
  /** Remove a stop from favorites. No-op when the stop isn't favorited. */
  remove: (stopId: string) => void;
  /** Whether a stop is currently favorited. */
  has: (stopId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export interface FavoritesProviderProps {
  children: ReactNode;
  /** Override the persistence layer. Defaults to `localStorage`. */
  storage?: FavoritesStorage;
}

export function FavoritesProvider({ children, storage }: FavoritesProviderProps) {
  // `storage` is the prop — closed over directly rather than held in a
  // ref. Tests pass an in-memory implementation; production omits the
  // prop and the loaders fall back to `localStorage` internally.
  const [favorites, setFavorites] = useState<Favorite[]>(() => loadFavorites(storage));

  const add = useCallback(
    (stopId: string): boolean => {
      let result = true;
      setFavorites((current) => {
        if (current.some((f) => f.stopId === stopId)) return current;
        if (current.length >= MAX_FAVORITES) {
          result = false;
          return current;
        }
        const next = [...current, { stopId, addedAt: Math.floor(Date.now() / 1000) }];
        saveFavorites(next, storage);
        return next;
      });
      return result;
    },
    [storage],
  );

  const remove = useCallback(
    (stopId: string) => {
      setFavorites((current) => {
        const next = current.filter((f) => f.stopId !== stopId);
        if (next.length === current.length) return current;
        saveFavorites(next, storage);
        return next;
      });
    },
    [storage],
  );

  const has = useCallback(
    (stopId: string) => favorites.some((f) => f.stopId === stopId),
    [favorites],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      isFull: favorites.length >= MAX_FAVORITES,
      add,
      remove,
      has,
    }),
    [favorites, add, remove, has],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (ctx === null) {
    throw new Error('useFavorites must be called inside a FavoritesProvider.');
  }
  return ctx;
}
