/**
 * Distribution layer for `GtfsRepository` instances.
 *
 * App-level code constructs whichever implementation is appropriate
 * (in-memory today, hybrid backend when ADR-0006 lands), wraps the
 * tree in `<GtfsRepositoryProvider>`, and every consumer gets the
 * same instance via `useGtfsRepository()`. No consumer imports a
 * concrete implementation — that is the single seam where the
 * architecture pivots.
 *
 * Tests inject a fake repository directly into the provider, so they
 * exercise consumers without standing up either the JSON bundle or
 * the backend mock harness.
 */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { GtfsRepository } from './GtfsRepository';

const GtfsRepositoryContext = createContext<GtfsRepository | null>(null);

/**
 * Exposed for direct test use — `<GtfsRepositoryContext.Provider value={fakeRepo}>`
 * is the same shape as `<GtfsRepositoryProvider repository={fakeRepo}>` and
 * occasionally easier to compose with other test wrappers.
 */
export { GtfsRepositoryContext };

export interface GtfsRepositoryProviderProps {
  repository: GtfsRepository;
  children: ReactNode;
}

export function GtfsRepositoryProvider({
  repository,
  children,
}: GtfsRepositoryProviderProps) {
  return (
    <GtfsRepositoryContext.Provider value={repository}>
      {children}
    </GtfsRepositoryContext.Provider>
  );
}

/**
 * The handle every consumer reaches for. Throws when called outside
 * the provider — a missing provider is a programming error, not a
 * runtime condition worth recovering from.
 */
export function useGtfsRepository(): GtfsRepository {
  const repo = useContext(GtfsRepositoryContext);
  if (repo === null) {
    throw new Error(
      'useGtfsRepository must be called inside a GtfsRepositoryProvider.',
    );
  }
  return repo;
}
