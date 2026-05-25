import { Routes, Route } from 'react-router-dom';

import { FavoritesProvider } from './features/favorites/FavoritesContext';
import { ToastProvider } from './features/toast/ToastContext';
import { Home } from './pages/Home';
import { Routes as RoutesPage } from './pages/Routes';
import { RouteDetail } from './pages/RouteDetail';
import { StopDetail } from './pages/StopDetail';

export function App() {
  return (
    <ToastProvider>
      <FavoritesProvider>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/route/:routeId" element={<RouteDetail />} />
            <Route path="/stop/:stopId" element={<StopDetail />} />
          </Routes>
        </main>
      </FavoritesProvider>
    </ToastProvider>
  );
}
