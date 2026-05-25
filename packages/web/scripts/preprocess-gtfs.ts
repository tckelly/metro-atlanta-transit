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

import { writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { parseGtfsZip, transformGtfs } from '../src/buildtime/preprocessGtfs';
import { buildGtfsSqlite } from '../src/buildtime/buildGtfsSqlite';

const MARTA_GTFS_URL = 'https://itsmarta.com/google_transit_feed/google_transit.zip';
const STALE_AFTER_HOURS = 24;

const here = dirname(fileURLToPath(import.meta.url));
/** Small reference data (stops, routes) — precached and held in memory by the client. */
const JSON_OUT_DIR = join(here, '..', 'public', 'gtfs');
/** Large schedule tables (trips, stop_times, calendar) — read server-side by the backend function. */
const SQLITE_DIR = join(here, '..', 'api', '_data');
const SQLITE_PATH = join(SQLITE_DIR, 'gtfs.sqlite');

/**
 * Returns true when *all* bundled GTFS artifacts (small JSON + the
 * backend SQLite) exist and the JSON is less than STALE_AFTER_HOURS
 * old. Both must be present — a missing SQLite from a previously-
 * failed run shouldn't be hidden by a recent stops.json mtime, or
 * we'd skip the next build and ship an inconsistent state.
 *
 * Vercel containers are ephemeral, so production never has a cache
 * hit here — the nightly cron always downloads fresh.
 */
async function isBundleFresh(): Promise<boolean> {
  try {
    const [stopsStat] = await Promise.all([
      stat(join(JSON_OUT_DIR, 'stops.json')),
      stat(join(JSON_OUT_DIR, 'routes.json')),
      stat(SQLITE_PATH),
    ]);
    const ageHours = (Date.now() - stopsStat.mtimeMs) / (1000 * 60 * 60);
    return ageHours < STALE_AFTER_HOURS;
  } catch {
    return false;
  }
}

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
  const path = join(JSON_OUT_DIR, filename);
  await writeFile(path, JSON.stringify(data), 'utf8');
  console.log(`  wrote ${path}`);
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  if (!force && (await isBundleFresh())) {
    console.log(
      `GTFS bundle is less than ${STALE_AFTER_HOURS}h old — skipping download. ` +
        `Use --force to refresh anyway.`,
    );
    return;
  }

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

  await mkdir(JSON_OUT_DIR, { recursive: true });
  await mkdir(SQLITE_DIR, { recursive: true });

  // Client-side JSON: only stops + routes per ADR-0006. The big three
  // (trips, stop_times, calendar) live in the SQLite the backend
  // reads — they don't ship to the client at all anymore.
  await Promise.all([
    writeJson('stops.json', bundle.stops),
    writeJson('routes.json', bundle.routes),
  ]);

  // Schedule tables → backend SQLite (ADR-0006). The Vercel Node
  // function reads this via better-sqlite3 at cold start. Removing any
  // prior copy first guarantees we don't append on top of stale schema.
  await rm(SQLITE_PATH, { force: true });
  const db = new Database(SQLITE_PATH);
  try {
    buildGtfsSqlite(bundle, db);
  } finally {
    db.close();
  }
  console.log(`  wrote ${SQLITE_PATH}`);

  console.log('Done.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
