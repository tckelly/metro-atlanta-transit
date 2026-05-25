# ADR-0006: Split static GTFS — small tables on the client, the big ones on the backend

**Status:** Accepted
**Date:** 2026-05-24

## Context

ADR-0004 set "static GTFS is preprocessed at build time and ships with the app." That decision held as long as the bundle was small. The first PWA build revealed it isn't:

```
calendar.json   2.6 KB
routes.json     7.5 KB
stops.json      782 KB
trips.json      5.2 MB
stop-times.json 253 MB
```

`stop_times.json` alone is 253 MB. Even gzipped it's tens of MB, and the cache stores decompressed size. The current app downloads this on first cold open and holds it on device. The realities:

- 253 MB blows through cellular data plans and fails on storage-constrained devices.
- iOS Safari evicts SW caches after ~7 days of inactivity, so a returning user pays the full re-download.
- Service worker precaching plain-refuses files over the configured limit, so the app's offline story breaks anyway.

The fix is to host the big tables behind the backend proxy ADR-0005 already established, and only ship to the client what the client actually needs.

## Decision

**Split the GTFS data along the natural seam between "reference data" and "schedule data":**

- **Client-side, static JSON (precached):** `stops.json` (~800 KB), `routes.json` (~8 KB). These are *reference data* — small, looked up synchronously from many places in the UI (stop names in headers, route metadata in browse pages). Keeping them in memory means metadata access stays sync and lazy-loading skeletons don't ripple through every render.
- **Backend, SQLite-backed:** `trips`, `stop_times`, `calendar`. The big tables, queried server-side via two endpoints (`/api/gtfs/stop-times` and `/api/gtfs/route-directions`). The build emits a `gtfs.sqlite` artifact alongside the small JSON files; the Vercel Node Function bundles the SQLite (per Vercel's `includeFiles`) and loads it at cold start with `better-sqlite3`.

The choice of `better-sqlite3` follows from research into Vercel's serverless model: native binding ships prebuilt linux-x64 binaries; bundling a ~30-50 MB SQLite into the function is well under Vercel's 250 MB unzipped / 50 MB zipped limit; sync prepared-statement performance is sub-millisecond for our access patterns once the file is `mmap`ed. Cold start is the trade-off — expect 300-800 ms on a fresh function instance. Vercel's Fluid Compute keeps function instances warm under sustained traffic; for commuter usage that warming will hide cold starts during peak hours.

`sql.js` (pure WASM) is the documented fallback if native-binding deployment turns out to be brittle on Vercel — same SQL queries, different driver. Turso embedded replicas are documented as the longer-term escape hatch if we ever outgrow a bundled DB.

The `GtfsRepository` interface introduced in the previous commit isolates consumers from this split entirely. `InMemoryGtfsRepository` keeps working from a full bundle (useful for tests and offline dev). `HybridGtfsRepository` — added in this round of work — delegates the sync metadata methods to a small in-memory bundle (`stops` + `routes` only) and the async query methods to HTTP calls against the backend functions. The choice between them is one line in `App.tsx`.

## Alternatives considered

**Just trim `stop_times.json` to the next 14 days.** Reduces ~253 MB → ~30-50 MB. Still requires every user to download tens of MB on first load, still re-downloaded after iOS Safari's 7-day eviction, still doesn't help users on cellular. Doesn't establish the backend pattern v2 features will want anyway. Rejected as a partial fix to a problem that has a clean full solution.

**Move the whole bundle to Vercel Postgres.** Hobby-tier storage cap (256 MB) is tight for the full feed and the operational surface (migrations, connection pooling, secrets) is meaningful. Rejected for v1; revisit only if SQLite-in-function turns out to be untenable.

**Vercel Blob with per-stop sharded JSON files.** Works, but ships ~5,000 small files and gives up the ability to do server-side joins between trips and stop_times. SQLite is the right shape for the queries; switching storage models to avoid native bindings is the wrong trade.

**`sql.js` instead of `better-sqlite3` from the start.** ~50-200 ms slower per cold start than native and uses more memory. Native is the right default; `sql.js` is documented as the fallback if native deployment fails. We commit to native and have an escape hatch, rather than commit to slow and not have one.

**Run `vercel dev` for local development so the function actually serves the SQLite locally.** Adds a Vercel CLI dependency and slows down dev. Rejected: dev uses `InMemoryGtfsRepository` against the full bundle; only production uses `HybridGtfsRepository` against the backend. The interface guarantees consumers don't notice. `import.meta.env.PROD` toggles in `App.tsx`.

## Consequences

**Pros:**

- Client bundle drops from 259 MB to ~810 KB. Mobile data and storage-constrained devices both win. iOS Safari cache eviction stops being a real cost.
- Backend pays for itself: the same Vercel deployment that proxies realtime now also hosts the schedule queries, no new infra to stand up.
- `stop_times` access becomes indexed (B-tree on `stop_id`, primary key on `(trip_id, stop_sequence)`) instead of a linear scan over a 250 MB array in browser memory.
- `GtfsRepository` interface keeps consumers oblivious. If we ever need to migrate again — e.g., to Postgres, or back to fully client-side — only the App-level wiring changes.
- ADR-0004's nightly rebuild model carries over unchanged: the cron runs, the preprocessor emits both the small JSON and the SQLite, the deploy ships them both.

**Cons:**

- One more network hop per stop view (now ~10 KB of JSON over HTTPS vs. an in-memory lookup). Edge cache (~10 s `s-maxage`) collapses repeats; client-side caching of recent queries can be added if it shows up as a UX issue.
- Cold-start latency on a fresh function is real (300-800 ms expected for the first query after idle). Mitigation: Vercel Fluid Compute keeps frequently-hit functions warm; commute-time usage means this will rarely bite real users.
- `better-sqlite3` is a native binding. If a Vercel build fails on a runtime mismatch (per [vercel/vercel#12040](https://github.com/vercel/vercel/issues/12040)) we need to either pin the version, switch to `sql.js`, or move to Turso.
- Dev/prod parity slips slightly: dev uses `InMemoryGtfsRepository`, prod uses `HybridGtfsRepository`. Both implement the same interface so the behavior is identical from the consumer's perspective — but a backend bug won't surface in `pnpm dev`. Mitigation: ship a Vercel Preview deployment for any change touching the backend.
- ADR-0004 is superseded *in part*: the build-time preprocessing model still applies; the storage destination changes from "JSON in /public/gtfs/" to "SQLite in the function bundle, plus small JSON in /public/gtfs/."

## Revisit when

- Native-binding deployment on Vercel breaks. Pivot to `sql.js`, or to Turso embedded replicas — both keep the same queries and the same `GtfsRepository` interface.
- The SQLite outgrows the 50 MB zipped function limit. At our current data size we have ~10× headroom; if that closes (multiple agencies, finer-grained data) we move to Vercel Postgres or Turso.
- v2 features (favorites sync, push notifications, historical reliability data) demand server-side persistence. At that point we already have a backend, and the `GtfsRepository` abstraction makes layering write paths in alongside the existing read paths straightforward.
