import { defineConfig, loadEnv, type Plugin } from 'vite';
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

// Rail differs from the bus feeds: MARTA's RTT endpoint is JSON on a
// non-standard port and requires a secret apiKey as a query param
// (ADR-0010). The production Edge Function (`api/marta/rail.ts`) injects
// the key from `process.env`; here we do the local equivalent, reading it
// from the gitignored `.env.local` so dev hits the same `/api/marta/rail`
// URL. The key stays server-side — it's only ever in this proxy's rewrite,
// never in the client bundle.
function railProxy(apiKey: string) {
  return {
    target: 'https://developerservices.itsmarta.com:18096',
    changeOrigin: true,
    rewrite: () =>
      `/itsmarta/railrealtimearrivals/developerservices/traindata?apiKey=${encodeURIComponent(apiKey)}`,
  };
}

// `loadEnv('', …, '')` reads `.env`/`.env.local` (mode-agnostic) with no
// prefix filter, so it picks up the non-`VITE_` server-only rail key that
// Vite deliberately keeps out of `import.meta.env`.
const localEnv = loadEnv('development', process.cwd(), '');

const MARTA_PROXY = {
  '/api/marta/tripupdates': martaProxy('/tripupdate/tripupdates.pb'),
  '/api/marta/vehiclepositions': martaProxy('/vehicle/vehiclepositions.pb'),
  '/api/marta/alerts': martaProxy('/alert/alerts.pb'),
  '/api/marta/rail': railProxy(localEnv.MARTA_RAIL_API_KEY ?? ''),
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
        // Precache the app shell only. The GTFS JSON (stops + routes)
        // is deliberately NOT precached: stops.json is ~1.3 MB
        // uncompressed (its per-stop `directions` pushed it past the
        // precache size cap below), and precaching would re-download
        // that copy on every nightly deploy via revision invalidation.
        // It's owned instead by the StaleWhileRevalidate runtime rule
        // for /gtfs/*.json further down — cached after the first online
        // load, revalidated cheaply on return visits. The big schedule
        // tables live in backend SQLite (ADR-0006), served by
        // /api/gtfs/* with its own runtime rule.
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
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
            // Static GTFS small bundle (stops, routes) — the PRIMARY (and
            // only) cache for these files now that they're out of precache
            // (see globPatterns above). The app fetches them eagerly at cold
            // open (BundleGate), so the first online load populates this
            // cache; every load after that is served instantly from it,
            // including fully offline.
            //
            // StaleWhileRevalidate (not CacheFirst): serve the cached copy
            // instantly, but refetch in the background so the *next* load
            // picks up a fresh bundle. The data changes nightly, and its
            // shape changes across releases — CacheFirst pinned a stale copy
            // for the full maxAge (up to 7 days), so a returning user could
            // miss new fields (e.g. per-stop `directions`). SWR keeps the
            // offline story (cache still serves when the network is down)
            // without freezing the data behind the TTL; the background
            // revalidate is a conditional GET, so it's a cheap 304 unless
            // the bundle actually changed.
            urlPattern: /\/gtfs\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
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
