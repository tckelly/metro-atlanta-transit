import { Suspense, lazy, useMemo } from 'react';
import type { ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import { ErrorBoundary, MessageCard } from '@atl-transit/components';

import { i18next } from './i18n/init';
import { FavoritesProvider } from './features/favorites/FavoritesContext';
import { RealtimeFeedProvider } from './features/realtime/RealtimeFeedContext';
import { RouteChunkFallback } from './features/route-chunk/RouteChunkFallback';
import { SettingsProvider } from './features/settings/SettingsContext';
import { ToastProvider } from './features/toast/ToastContext';
import { LoadingShell } from './LoadingShell';
import { GtfsRepositoryProvider } from './services/gtfs/GtfsRepositoryContext';
import {
  HybridGtfsRepository,
  type SmallGtfsBundle,
} from './services/gtfs/HybridGtfsRepository';
import { useSmallGtfsBundle } from './services/useSmallGtfsBundle';

// Route-level code-splitting. Each page becomes its own chunk so the
// initial Home load doesn't pull StopDetail, Routes, RouteDetail, and
// Settings into the entry bundle. Vite's manual-chunks heuristics
// recognize dynamic imports and emit separate files automatically.
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const RoutesPage = lazy(() =>
  import('./pages/Routes').then((m) => ({ default: m.Routes })),
);
const RouteDetail = lazy(() =>
  import('./pages/RouteDetail').then((m) => ({ default: m.RouteDetail })),
);
const Settings = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.Settings })),
);
const StopDetail = lazy(() =>
  import('./pages/StopDetail').then((m) => ({ default: m.StopDetail })),
);

export function App() {
  return (
    <I18nextProvider i18n={i18next}>
      <SettingsProvider>
        <ToastProvider>
          <FavoritesProvider>
            <main className="mx-auto max-w-2xl px-4 py-6">
              <BundleGate>
                {(bundle) => (
                  <RepositoryGate bundle={bundle}>
                    <RealtimeFeedProvider>
                      <RouteShield>
                        <Suspense fallback={<RouteChunkFallback />}>
                          <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/routes" element={<RoutesPage />} />
                            <Route path="/route/:routeId" element={<RouteDetail />} />
                            <Route path="/stop/:stopId" element={<StopDetail />} />
                            <Route path="/settings" element={<Settings />} />
                          </Routes>
                        </Suspense>
                      </RouteShield>
                    </RealtimeFeedProvider>
                  </RepositoryGate>
                )}
              </BundleGate>
            </main>
          </FavoritesProvider>
        </ToastProvider>
      </SettingsProvider>
    </I18nextProvider>
  );
}

/**
 * Blocks the rest of the app until the small reference bundle
 * (stops + routes) is loaded. Big tables are served by the backend
 * (ADR-0006), not bundled with the client.
 */
function BundleGate({ children }: { children: (bundle: SmallGtfsBundle) => ReactNode }) {
  const { t } = useTranslation();
  const { bundle, loading, error } = useSmallGtfsBundle();
  if (loading) return <LoadingShell />;
  if (error !== null) {
    return <MessageCard title={t('bundle.errorTitle')} body={error.message} />;
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

/**
 * Route-level error boundary. A render-time crash inside one route
 * stays scoped to that route — the user can still navigate elsewhere
 * via the home link in the fallback or the browser back button. The
 * resetKey clears the error on navigation so a successful next route
 * mounts cleanly.
 */
function RouteShield({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  return (
    <ErrorBoundary
      resetKey={location.pathname}
      fallback={(error) => (
        <MessageCard
          title={t('routeShield.title')}
          body={t('routeShield.body', { message: error.message })}
          action={
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center rounded-md border border-divider px-4 text-sm font-medium text-fg hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('routeShield.backHome')}
            </Link>
          }
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
