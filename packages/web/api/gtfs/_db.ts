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
 * `vercel.json` includeFiles (see ADR-0006). At runtime its path is
 * resolved relative to this module file, which Vercel deploys
 * alongside the data directory.
 */
import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SQLITE_PATH = join(here, '..', '_data', 'gtfs.sqlite');

let cached: Database.Database | null = null;

export function getGtfsDb(): Database.Database {
  if (cached !== null) return cached;
  cached = new Database(SQLITE_PATH, { readonly: true, fileMustExist: true });
  // The preprocessor wrote the file in WAL; mark the connection
  // accordingly so reads play nicely with the journal.
  cached.pragma('journal_mode = WAL');
  return cached;
}
