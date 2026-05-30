/**
 * Pure list operation behind the Reorder favorites UI.
 *
 * Returns the same array reference when the move is a no-op (top-up,
 * bottom-down, unknown stopId, single-item list, empty list). Reference
 * stability is the contract: `FavoritesContext` skips the storage write
 * (and React skips the re-render) when the reducer returns the same
 * array, so callers don't need a separate "did anything change" check.
 */
import type { Favorite } from '../../services/storage';

export type MoveDirection = 'up' | 'down';

export function moveFavorite(
  list: Favorite[],
  stopId: string,
  direction: MoveDirection,
): Favorite[] {
  const index = list.findIndex((f) => f.stopId === stopId);
  if (index === -1) return list;

  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return list;

  const a = list[index];
  const b = list[target];
  // Bounds checks above guarantee both exist; this narrowing satisfies
  // `noUncheckedIndexedAccess` without a non-null assertion.
  if (a === undefined || b === undefined) return list;

  const next = list.slice();
  next[index] = b;
  next[target] = a;
  return next;
}
