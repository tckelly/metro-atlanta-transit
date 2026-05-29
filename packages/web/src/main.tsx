import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { pickRouteChunk } from './preloadInitialRoute';
import './styles/index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

// Kick off the route-chunk fetch in parallel with the GTFS bundle fetch
// that `BundleGate` will trigger on first render. Same module identity
// as the `lazy()` import in App.tsx, so Vite serves one chunk and the
// browser fetches it once. See `preloadInitialRoute.ts` for the why.
void pickRouteChunk(window.location.pathname, {
  home: () => import('./pages/Home'),
  routes: () => import('./pages/Routes'),
  routeDetail: () => import('./pages/RouteDetail'),
  stopDetail: () => import('./pages/StopDetail'),
  settings: () => import('./pages/Settings'),
})();

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
