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
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SQLITE_PATH = join(process.cwd(), 'api', '_data', 'gtfs.sqlite');

let cached: Database.Database | null = null;

export function getGtfsDb(): Database.Database {
  if (cached !== null) return cached;

  // Vercel's bundled-function runtime sometimes places includeFiles at
  // a different path than the docs imply. On a miss, emit cwd + tree
  // in the error so the next log file tells us where the file landed
  // and we can fix the resolution rather than guessing.
  if (!existsSync(SQLITE_PATH)) {
    const cwdEntries = existsSync(process.cwd()) ? readdirSync(process.cwd()) : [];
    const apiPath = join(process.cwd(), 'api');
    const apiEntries = existsSync(apiPath) ? readdirSync(apiPath) : null;
    throw new Error(
      `GTFS SQLite not found at ${SQLITE_PATH}. ` +
        `cwd=${process.cwd()}; ` +
        `cwd contents=${JSON.stringify(cwdEntries.slice(0, 30))}; ` +
        `api/ contents=${JSON.stringify(apiEntries)}`,
    );
  }

  cached = new Database(SQLITE_PATH, { readonly: true, fileMustExist: true });
  // The preprocessor wrote the file in WAL; mark the connection
  // accordingly so reads play nicely with the journal.
  cached.pragma('journal_mode = WAL');
  return cached;
}
