/**
 * Build-time orchestrator for static GTFS preprocessing.
 *
 * Downloads MARTA's google_transit.zip, runs it through the parse + transform
 * library, and writes the 5 trimmed JSON files to packages/web/public/gtfs/.
 *
 * Runs via: pnpm --filter @atl-transit/web preprocess-gtfs
 * Will be wired into `prebuild` once Vite is added.
 *
 * See docs/architecture.md for the broader context, and ADR-0004 for why
 * this is build-time rather than runtime.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseGtfsZip, transformGtfs } from '../src/buildtime/preprocessGtfs';

const MARTA_GTFS_URL = 'https://itsmarta.com/google_transit_feed/google_transit.zip';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, '..', 'public', 'gtfs');

async function downloadZip(url: string): Promise<Uint8Array> {
  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GTFS download failed: ${res.status} ${res.statusText}`);
  }
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

async function writeJson(filename: string, data: unknown): Promise<void> {
  const path = join(OUT_DIR, filename);
  await writeFile(path, JSON.stringify(data), 'utf8');
  console.log(`  wrote ${path}`);
}

async function main(): Promise<void> {
  const zipBytes = await downloadZip(MARTA_GTFS_URL);
  console.log(`Downloaded ${zipBytes.length} bytes`);

  console.log('Parsing GTFS ZIP...');
  const raw = await parseGtfsZip(zipBytes);

  console.log('Transforming...');
  const bundle = transformGtfs(raw);
  console.log(
    `  ${bundle.stops.length} stops, ${bundle.routes.length} routes, ` +
      `${bundle.trips.length} trips, ${bundle.stopTimes.length} stop_times, ` +
      `${bundle.calendar.rules.length} calendar rules`,
  );

  await mkdir(OUT_DIR, { recursive: true });
  await Promise.all([
    writeJson('stops.json', bundle.stops),
    writeJson('routes.json', bundle.routes),
    writeJson('trips.json', bundle.trips),
    writeJson('stop-times.json', bundle.stopTimes),
    writeJson('calendar.json', bundle.calendar),
  ]);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
