/**
 * Emit the static GTFS bundle as a SQLite database, ready to be loaded
 * by the backend stop-times / route-directions Node functions (see
 * ADR-0006).
 *
 * The DB receives `trips`, `stop_times`, and `calendar_*` — the three
 * tables the client no longer carries. Indices match the runtime
 * query patterns: `stop_times` by `stop_id` for per-stop arrivals,
 * `trips` by `route_id` for browse-by-route.
 *
 * Pure over `(bundle, db)`. Tests pass a `:memory:` database; the
 * preprocessor passes an on-disk path.
 */
import type Database from 'better-sqlite3';

import type { GtfsBundle } from './preprocessGtfs';

export function buildGtfsSqlite(bundle: GtfsBundle, db: Database.Database): void {
  // Wrap the whole build in a single transaction for speed — SQLite
  // commits after every statement otherwise, which would make
  // inserting ~50k rows of stop_times take seconds.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');

  db.exec(`
    CREATE TABLE trips (
      trip_id       TEXT PRIMARY KEY,
      route_id      TEXT NOT NULL,
      service_id    TEXT NOT NULL,
      headsign      TEXT NOT NULL,
      direction_id  INTEGER
    );
    CREATE INDEX idx_trips_route_id   ON trips(route_id);
    CREATE INDEX idx_trips_service_id ON trips(service_id);

    CREATE TABLE stop_times (
      trip_id        TEXT NOT NULL,
      stop_id        TEXT NOT NULL,
      stop_sequence  INTEGER NOT NULL,
      arrival_time   TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      PRIMARY KEY (trip_id, stop_sequence)
    );
    CREATE INDEX idx_stop_times_stop_id ON stop_times(stop_id);

    CREATE TABLE calendar_rules (
      service_id  TEXT PRIMARY KEY,
      monday      INTEGER NOT NULL,
      tuesday     INTEGER NOT NULL,
      wednesday   INTEGER NOT NULL,
      thursday    INTEGER NOT NULL,
      friday      INTEGER NOT NULL,
      saturday    INTEGER NOT NULL,
      sunday      INTEGER NOT NULL,
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL
    );

    CREATE TABLE calendar_exceptions (
      service_id TEXT NOT NULL,
      date       TEXT NOT NULL,
      type       TEXT NOT NULL CHECK(type IN ('added', 'removed')),
      PRIMARY KEY (service_id, date)
    );
  `);

  const insertTrip = db.prepare(
    'INSERT INTO trips (trip_id, route_id, service_id, headsign, direction_id) VALUES (?, ?, ?, ?, ?)',
  );
  const insertStopTime = db.prepare(
    'INSERT INTO stop_times (trip_id, stop_id, stop_sequence, arrival_time, departure_time) VALUES (?, ?, ?, ?, ?)',
  );
  const insertRule = db.prepare(
    `INSERT INTO calendar_rules
       (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertException = db.prepare(
    'INSERT INTO calendar_exceptions (service_id, date, type) VALUES (?, ?, ?)',
  );

  const insertAll = db.transaction(() => {
    for (const trip of bundle.trips) {
      insertTrip.run(
        trip.tripId,
        trip.routeId,
        trip.serviceId,
        trip.headsign,
        trip.directionId ?? null,
      );
    }
    for (const st of bundle.stopTimes) {
      insertStopTime.run(
        st.tripId,
        st.stopId,
        st.stopSequence,
        st.arrivalTime,
        st.departureTime,
      );
    }
    for (const rule of bundle.calendar.rules) {
      const [mon, tue, wed, thu, fri, sat, sun] = rule.weekdays;
      insertRule.run(
        rule.serviceId,
        mon ? 1 : 0,
        tue ? 1 : 0,
        wed ? 1 : 0,
        thu ? 1 : 0,
        fri ? 1 : 0,
        sat ? 1 : 0,
        sun ? 1 : 0,
        rule.startDate,
        rule.endDate,
      );
    }
    for (const exc of bundle.calendar.exceptions) {
      insertException.run(exc.serviceId, exc.date, exc.type);
    }
  });

  insertAll();
}
