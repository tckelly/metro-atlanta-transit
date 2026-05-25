import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MessageCard } from '@atl-transit/components';

import { FavoritesProvider } from './features/favorites/FavoritesContext';
import { RealtimeFeedProvider } from './features/realtime/RealtimeFeedContext';
import { ToastProvider } from './features/toast/ToastContext';
import { GtfsRepositoryProvider } from './services/gtfs/GtfsRepositoryContext';
import {
  HybridGtfsRepository,
  type SmallGtfsBundle,
} from './services/gtfs/HybridGtfsRepository';
import { useSmallGtfsBundle } from './services/useSmallGtfsBundle';
import { Home } from './pages/Home';
import { Routes as RoutesPage } from './pages/Routes';
import { RouteDetail } from './pages/RouteDetail';
import { StopDetail } from './pages/StopDetail';

export function App() {
  return (
    <ToastProvider>
      <FavoritesProvider>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <BundleGate>
            {(bundle) => (
              <RepositoryGate bundle={bundle}>
                <RealtimeFeedProvider>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/routes" element={<RoutesPage />} />
                    <Route path="/route/:routeId" element={<RouteDetail />} />
                    <Route path="/stop/:stopId" element={<StopDetail />} />
                  </Routes>
                </RealtimeFeedProvider>
              </RepositoryGate>
            )}
          </BundleGate>
        </main>
      </FavoritesProvider>
    </ToastProvider>
  );
}

/**
 * Blocks the rest of the app until the small reference bundle
 * (stops + routes) is loaded. Big tables are served by the backend
 * (ADR-0006), not bundled with the client.
 */
function BundleGate({ children }: { children: (bundle: SmallGtfsBundle) => ReactNode }) {
  const { bundle, loading, error } = useSmallGtfsBundle();
  if (loading) return <MessageCard title="Loading schedule data…" body="One moment." />;
  if (error !== null) {
    return <MessageCard title="Couldn’t load schedule data" body={error.message} />;
  }
  if (bundle === null) return null;
  return <>{children(bundle)}</>;
}

/**
 * Constructs the production repository once per bundle reference.
 * `HybridGtfsRepository` serves sync metadata from the in-memory
 * `bundle` and async queries from the backend `/api/gtfs/*` endpoints.
 * Tests inject their own repo via `GtfsRepositoryContext.Provider`
 * directly — never go through this gate.
 */
function RepositoryGate({
  bundle,
  children,
}: {
  bundle: SmallGtfsBundle;
  children: ReactNode;
}) {
  const repository = useMemo(() => new HybridGtfsRepository({ bundle }), [bundle]);
  return <GtfsRepositoryProvider repository={repository}>{children}</GtfsRepositoryProvider>;
}
