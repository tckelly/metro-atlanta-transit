/**
 * Cold-open optimization: start downloading the route chunk the user
 * is about to need *in parallel with* the small GTFS bundle fetch,
 * instead of waiting for `Suspense` to discover it after the bundle
 * resolves. See `docs/launch-checklist.md` § "Cold-open loading state"
 * for the user-visible problem this solves.
 *
 * Vite gives a separate chunk to every dynamic `import()` target, and
 * deduplicates by module identity — so calling `import('./pages/Home')`
 * from both here and `lazy()` in `App.tsx` produces one chunk that the
 * browser only fetches once. When Suspense later asks for it, the
 * fetch is already in-flight (or already resolved).
 *
 * The picker is a pure function over an injected importer table so
 * tests can pass stubs without rewriting the module graph; `main.tsx`
 * wires it to the real `import()` calls.
 */
export type RouteChunkImporter = () => Promise<unknown>;

export interface RouteChunkMap {
  home: RouteChunkImporter;
  routes: RouteChunkImporter;
  routeDetail: RouteChunkImporter;
  stopDetail: RouteChunkImporter;
  settings: RouteChunkImporter;
}

export function pickRouteChunk(
  pathname: string,
  chunks: RouteChunkMap,
): RouteChunkImporter {
  if (pathname.startsWith('/routes')) return chunks.routes;
  if (pathname.startsWith('/route/')) return chunks.routeDetail;
  if (pathname.startsWith('/stop/')) return chunks.stopDetail;
  if (pathname.startsWith('/settings')) return chunks.settings;
  return chunks.home;
}
