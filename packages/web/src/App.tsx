import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MessageCard } from '@atl-transit/components';

import { FavoritesProvider } from './features/favorites/FavoritesContext';
import { RealtimeFeedProvider } from './features/realtime/RealtimeFeedContext';
import { ToastProvider } from './features/toast/ToastContext';
import { GtfsRepositoryProvider } from './services/gtfs/GtfsRepositoryContext';
import { InMemoryGtfsRepository } from './services/gtfs/InMemoryGtfsRepository';
import { useGtfsBundle } from './services/useGtfsBundle';
import { Home } from './pages/Home';
import { Routes as RoutesPage } from './pages/Routes';
import { RouteDetail } from './pages/RouteDetail';
import { StopDetail } from './pages/StopDetail';
import type { GtfsBundle } from './buildtime/preprocessGtfs';

export function App() {
  return (
    <ToastProvider>
      <FavoritesProvider>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <BundleGate>
            {(bundle) => (
              <GtfsRepositoryGate bundle={bundle}>
                <RealtimeFeedProvider>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/routes" element={<RoutesPage />} />
                    <Route path="/route/:routeId" element={<RouteDetail />} />
                    <Route path="/stop/:stopId" element={<StopDetail />} />
                  </Routes>
                </RealtimeFeedProvider>
              </GtfsRepositoryGate>
            )}
          </BundleGate>
        </main>
      </FavoritesProvider>
    </ToastProvider>
  );
}

/**
 * Block the rest of the app until the static GTFS bundle has loaded.
 * Centralizing this here means downstream pages never have to write
 * "bundle is null" branches — by the time they render, the repository
 * is populated and the small reference data is sync-readable.
 */
function BundleGate({ children }: { children: (bundle: GtfsBundle) => ReactNode }) {
  const { bundle, loading, error } = useGtfsBundle();
  if (loading) return <MessageCard title="Loading schedule data…" body="One moment." />;
  if (error !== null) {
    return <MessageCard title="Couldn’t load schedule data" body={error.message} />;
  }
  if (bundle === null) return null;
  return <>{children(bundle)}</>;
}

/**
 * Builds the repository once per bundle reference so consumers don't
 * receive a fresh context value on every render — that would re-run
 * every dependent effect (polling, async fetches) without reason.
 */
function GtfsRepositoryGate({
  bundle,
  children,
}: {
  bundle: GtfsBundle;
  children: ReactNode;
}) {
  const repository = useMemo(() => new InMemoryGtfsRepository(bundle), [bundle]);
  return <GtfsRepositoryProvider repository={repository}>{children}</GtfsRepositoryProvider>;
}
