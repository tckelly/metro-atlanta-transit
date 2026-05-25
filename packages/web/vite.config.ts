import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [react()],
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
