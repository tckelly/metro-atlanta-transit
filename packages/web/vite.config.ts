import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      // MARTA's realtime feeds don't send Access-Control-Allow-Origin,
      // so the browser blocks direct fetches. Vite proxies these in dev,
      // stripping the CORS check. Production will use a Vercel serverless
      // function (see docs/architecture.md "Realtime fetching").
      '/api/marta': {
        target: 'https://gtfs-rt.itsmarta.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/marta/, '/TMGTFSRealTimeWebService'),
      },
    },
  },
});
