/**
 * SQLite connection lifecycle for the backend GTFS functions.
 *
 * Vercel keeps Node function instances warm between invocations, so
 * we cache the database handle at module scope — cold-start pays the
 * open + `mmap` cost once, subsequent requests reuse the connection.
 * Read-only opening signals our intent and lets SQLite skip some
 * locking overhead.
 *
 * The SQLite file is included in the function bundle via
 * `vercel.json` includeFiles (see ADR-0006). At runtime the file
 * lives at `<cwd>/api/_data/gtfs.sqlite` — Vercel mounts includeFiles
 * relative to the function root, which is process.cwd(). The Vite dev
 * middleware runs from `packages/web/`, which puts the same path at
 * `packages/web/api/_data/gtfs.sqlite`. Same resolution in both.
 */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Vercel runs monorepo functions from the repo root (/var/task) and
// places `includeFiles` at their full repo-relative path
// (packages/web/api/_data/...). Local `vite preview` runs from
// packages/web/, so the same file is at api/_data/ relative to cwd.
// Probe both — first hit wins.
const CANDIDATE_PATHS = [
  join(process.cwd(), 'api', '_data', 'gtfs.sqlite'),
  join(process.cwd(), 'packages', 'web', 'api', '_data', 'gtfs.sqlite'),
];

function resolveSqlitePath(): string {
  for (const candidate of CANDIDATE_PATHS) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `GTFS SQLite not found. cwd=${process.cwd()}; ` +
      `tried=${CANDIDATE_PATHS.join(' ; ')}`,
  );
}

let cached: Database.Database | null = null;

export function getGtfsDb(): Database.Database {
  if (cached !== null) return cached;
  cached = new Database(resolveSqlitePath(), { readonly: true, fileMustExist: true });
  // The preprocessor wrote the file in WAL; mark the connection
  // accordingly so reads play nicely with the journal.
  cached.pragma('journal_mode = WAL');
  return cached;
}
