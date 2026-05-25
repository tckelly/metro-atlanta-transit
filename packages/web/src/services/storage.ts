/**
 * localStorage-backed persistence for user favorites.
 *
 * Favorites are external input to the app every time we read them (the
 * user — or any other tab — may have written something unexpected), so
 * we validate with Zod on read. Corrupted state is recoverable: we drop
 * back to an empty list rather than crashing.
 *
 * Storage is injected to keep the module pure and testable without
 * touching the global `window.localStorage`.
 */
import { z } from 'zod';

/** Bumping the suffix lets us hard-reset stored data after a shape change. */
export const FAVORITES_STORAGE_KEY = 'atl-transit:favorites:v1';

/**
 * Hard cap on favorites count. The home screen is a glanceable list, not
 * a database — past ~10 entries it stops being useful. Enforced at the
 * write boundary so the invariant holds even if a future caller forgets.
 */
export const MAX_FAVORITES = 10;

const FavoriteSchema = z.object({
  stopId: z.string().min(1),
  addedAt: z.number().int().nonnegative(),
});

const FavoritesSchema = z.array(FavoriteSchema);

export type Favorite = z.infer<typeof FavoriteSchema>;

/**
 * Minimal subset of the Web Storage API we depend on. Defined locally so
 * tests can pass an in-memory implementation without coupling to jsdom's
 * global localStorage.
 */
export interface FavoritesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): FavoritesStorage {
  return globalThis.localStorage;
}

/**
 * Read the persisted favorites. Returns an empty array (with a console
 * warning) if the stored value is missing, not JSON, or fails schema
 * validation — the user's app should never blank-screen because of a
 * corrupt localStorage entry.
 */
export function loadFavorites(storage: FavoritesStorage = defaultStorage()): Favorite[] {
  const raw = storage.getItem(FAVORITES_STORAGE_KEY);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`[favorites] dropping malformed JSON in ${FAVORITES_STORAGE_KEY}:`, err);
    return [];
  }

  const result = FavoritesSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[favorites] dropping value in ${FAVORITES_STORAGE_KEY} that failed validation:`,
      result.error.issues,
    );
    return [];
  }
  return result.data;
}

/**
 * Persist the favorites list. An empty list clears the key entirely so
 * we don't leave `"[]"` lying around in storage. Throws if `MAX_FAVORITES`
 * would be exceeded — callers must enforce the cap before reaching here.
 */
export function saveFavorites(
  favorites: Favorite[],
  storage: FavoritesStorage = defaultStorage(),
): void {
  if (favorites.length > MAX_FAVORITES) {
    throw new Error(
      `Cannot save ${favorites.length} favorites: max is ${MAX_FAVORITES}.`,
    );
  }
  if (favorites.length === 0) {
    storage.removeItem(FAVORITES_STORAGE_KEY);
    return;
  }
  storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}
