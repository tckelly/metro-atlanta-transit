import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// MARTA's GTFS-RT endpoints don't send Access-Control-Allow-Origin,
// so the browser blocks direct fetches. In production this is solved
// by Vercel Edge Functions in `api/marta/*.ts` (see ADR-0005). Locally
// we replicate the same URL shape by proxying server-to-server here,
// so the client never has to branch on environment.
function martaProxy(upstreamPath: string) {
  return {
    target: 'https://gtfs-rt.itsmarta.com',
    changeOrigin: true,
    rewrite: () => `/TMGTFSRealTimeWebService${upstreamPath}`,
  };
}

const MARTA_PROXY = {
  '/api/marta/tripupdates': martaProxy('/tripupdate/tripupdates.pb'),
  '/api/marta/vehiclepositions': martaProxy('/vehicle/vehiclepositions.pb'),
  '/api/marta/alerts': martaProxy('/alert/alerts.pb'),
};

// Shared GTFS backend middleware. Runs the same `/api/gtfs/*`
// handlers Vercel runs in production (see ADR-0006), letting
// `HybridGtfsRepository` work locally without `vercel dev`.
//
// Imports are deferred so Vite's startup doesn't try to bundle
// better-sqlite3 into the client. Each request lazily loads the
// handler module on first use; subsequent requests reuse the module
// cache.
async function gtfsBackendMiddleware(
  req: { url?: string | undefined; method?: string | undefined; headers: { host?: string | undefined } },
  res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (chunk?: string) => void;
  },
  next: () => void,
): Promise<void> {
  const url = req.url ?? '';
  if (!url.startsWith('/api/gtfs/')) {
    next();
    return;
  }
  try {
    const { getGtfsDb } = await import('./api/gtfs/_db.ts');
    let handler: ((req: Request, db: ReturnType<typeof getGtfsDb>) => Promise<Response>) | null = null;
    if (url.startsWith('/api/gtfs/stop-times')) {
      handler = (await import('./api/gtfs/stop-times.ts')).handleStopTimes;
    } else if (url.startsWith('/api/gtfs/route-directions')) {
      handler = (await import('./api/gtfs/route-directions.ts')).handleRouteDirections;
    } else if (url.startsWith('/api/gtfs/trip-stops')) {
      handler = (await import('./api/gtfs/trip-stops.ts')).handleTripStops;
    }
    if (handler === null) {
      next();
      return;
    }
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${url}`, {
      method: req.method ?? 'GET',
    });
    const response = await handler(request, getGtfsDb());
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await response.text());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end(
      `GTFS backend middleware failed: ${message}\n` +
        `If the SQLite file is missing, run \`pnpm preprocess-gtfs --force\` first.`,
    );
  }
}

/**
 * Installs the GTFS backend middleware in BOTH the dev server
 * (`vite dev`) and the preview server (`vite preview`). Preview is
 * meant to test the production bundle locally — without this hook,
 * `/api/gtfs/*` falls through to the SPA fallback and returns
 * `index.html`, producing the classic "Unexpected token '<', '<!doctype'
 * is not valid JSON" error in the client.
 */
function gtfsBackendPlugin(): Plugin {
  return {
    name: 'gtfs-backend-local',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void gtfsBackendMiddleware(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void gtfsBackendMiddleware(req, res, next);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    gtfsBackendPlugin(),
    VitePWA({
      // generateSW mode: declarative config, plugin emits the SW.
      // Switch to injectManifest only when we need custom SW code
      // (background sync, push, etc.) — not needed in v1.
      strategies: 'generateSW',
      // Auto-apply new service worker when a fresh build is ready.
      // Right for an app like this where users aren't editing
      // persistent state that an update would clobber.
      registerType: 'autoUpdate',
      // Plugin injects the SW registration into the built HTML. No
      // change needed to main.tsx; if we later need finer control
      // (custom update flow, prompt-the-user UX) we switch this to
      // false and import `virtual:pwa-register` ourselves.
      injectRegister: 'auto',
      // Service worker stays off in dev; SW caching aggressively
      // masks real changes during iterative work. Toggle via
      // ?pwa-dev=true in the URL or this flag if testing locally.
      devOptions: { enabled: false },
      includeAssets: [
        'icons/icon.svg',
        'icons/maskable-icon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-icon-512.png',
        'icons/apple-touch-icon-180.png',
      ],
      manifest: {
        name: 'Atlanta Transit',
        short_name: 'ATL Transit',
        description:
          'Real-time MARTA bus arrivals for metro Atlanta. Unofficial — not affiliated with MARTA.',
        theme_color: '#0066CC',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        // SVG-first: modern browsers (iOS 26+, current Chrome) pick the
        // vector entries and stay sharp at any density. PNG fallbacks
        // exist for older iOS / Android versions that ignore SVG icons
        // in the manifest. See public/icons/README.md for regen.
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/maskable-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/maskable-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell plus the small GTFS JSON files
        // (stops + routes only after ADR-0006). The big tables now
        // live in the backend SQLite — served by /api/gtfs/* with
        // its own runtime cache rule below.
        globPatterns: [
          '**/*.{js,css,html,svg,ico}',
          'gtfs/routes.json',
          'gtfs/stops.json',
        ],
        // Hard cap — anything larger gets skipped from precache and
        // logged. Set well above our small-file ceiling so we never
        // silently include something gigantic.
        maximumFileSizeToCacheInBytes: 1 * 1024 * 1024,
        // Single-page-app navigation fallback: any in-app route
        // should serve index.html out of the precache.
        navigateFallback: '/index.html',
        // Don't intercept the realtime proxy or any /api routes —
        // they have their own caching strategy below.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Realtime feeds: try the network, fall back to the most
            // recent cached response if the request takes longer than
            // 5 seconds or fails outright. "Stale data with a label"
            // beats "blank screen" — the UI surfaces freshness already.
            urlPattern: /\/api\/marta\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'marta-realtime',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 5, // 5 minutes — stale beyond this is too misleading
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Static GTFS small bundle (stops, routes): precached,
            // but if the user installs the PWA before the bundle is
            // in precache (rare), this is the safety net.
            urlPattern: /\/gtfs\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gtfs-static',
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Backend GTFS query endpoints — try the network, fall back
            // to cache. Schedule queries change at most nightly so
            // short-but-not-zero edge cache + a small browser cache
            // smooths spotty connections.
            urlPattern: /\/api\/gtfs\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gtfs-backend',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: MARTA_PROXY,
  },
  // Preview (used by `pnpm preview` / `pnpm preview:prod`) needs the
  // same MARTA proxy as dev — otherwise the production bundle running
  // locally would try to fetch MARTA's protobuf directly and the
  // browser would block it on CORS.
  preview: {
    port: 4173,
    host: '127.0.0.1',
    proxy: MARTA_PROXY,
  },
});
