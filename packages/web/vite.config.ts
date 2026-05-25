import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// MARTA's GTFS-RT endpoints don't send Access-Control-Allow-Origin,
// so the browser blocks direct fetches. In production this is solved
// by Vercel Edge Functions in `api/marta/*.ts` (see ADR-0005). In dev
// we replicate the same URL shape by proxying server-to-server here,
// so the client never has to branch on environment.
function martaProxy(upstreamPath: string) {
  return {
    target: 'https://gtfs-rt.itsmarta.com',
    changeOrigin: true,
    rewrite: () => `/TMGTFSRealTimeWebService${upstreamPath}`,
  };
}

export default defineConfig({
  plugins: [
    react(),
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
      includeAssets: ['icons/icon.svg', 'icons/maskable-icon.svg'],
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
        ],
      },
      workbox: {
        // Precache the app shell plus the *small* GTFS JSON files
        // (calendar, routes, stops). The large ones — trips.json
        // (~5 MB) and especially stop-times.json (~250 MB!) — are
        // way too big to precache and are an open architectural
        // concern. They're served by the runtime cache below; on
        // first load the user pays the network cost. See the
        // outstanding "GTFS bundle size" note in M5 follow-ups.
        globPatterns: [
          '**/*.{js,css,html,svg,ico}',
          'gtfs/calendar.json',
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
            // Static GTFS bundle: precached, but if the user installs
            // the PWA before the bundle is in precache (rare), this
            // is the safety net. CacheFirst because the bundle is
            // refreshed via deploy, not at runtime.
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
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api/marta/tripupdates': martaProxy('/tripupdate/tripupdates.pb'),
      '/api/marta/vehiclepositions': martaProxy('/vehicle/vehiclepositions.pb'),
      '/api/marta/alerts': martaProxy('/alert/alerts.pb'),
    },
  },
});
