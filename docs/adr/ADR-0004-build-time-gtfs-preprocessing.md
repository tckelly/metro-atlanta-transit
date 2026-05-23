# ADR-0004: Build-time static GTFS preprocessing with nightly rebuilds

**Status:** Accepted
**Date:** 2026-05-23

## Context

Atlanta Transit needs MARTA's static schedule data — every stop's name and coordinates, every route's list of stops, every trip's scheduled times — to make the real-time GTFS-RT data meaningful. A `tripId` like `"10802068"` from `trip_updates.pb` tells the user nothing without static data to resolve it into "Route 36, scheduled 12:34, headed to Decatur Station."

MARTA publishes this as a ZIP at `https://itsmarta.com/google_transit_feed/google_transit.zip`. The ZIP is large — multiple tens of megabytes when extracted, with `stop_times.txt` alone exceeding 30 MB. It changes roughly weekly, sometimes less often.

We need a strategy for getting this data into the browser without violating the 2-second cold-open target (see `product-requirements.md`) and — given ADR-0001 — without a backend.

## Decision

A **build-time preprocessing pipeline** combined with **nightly rebuilds**:

1. A script (`scripts/preprocess-gtfs.ts`) runs before every Vite build. It downloads `google_transit.zip`, unzips, parses the CSV files we use (`stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`), trims to the fields the app actually consumes, and emits a small set of JSON files (`stops.json`, `routes.json`, `trips-by-stop.json`) to `packages/web/public/gtfs/`. Vite picks them up as static assets; the service worker precaches them.
2. A **GitHub Actions cron** runs **nightly at 08:00 UTC** (4am EDT in summer, 3am EST in winter — both safely before MARTA's earliest morning service around 4:30am ET). It pushes an empty commit to `main`, triggering a Vercel rebuild, which re-runs the preprocess script and ships fresh data.

## Alternatives considered

**Runtime fetch in the browser.** Download the multi-tens-of-MB ZIP on first app open, unzip and parse in the browser, render. Rejected because that's a 5–10 second first-load on a phone over 4G — directly violates the 2-second cold-open product requirement. Even with progressive parsing, you're paying the network cost the user can least afford to pay.

**IndexedDB seeding on first launch.** Download once, parse, store in IndexedDB, reuse on subsequent launches. Rejected because:

- First launch is still slow (the user's worst impression of the app).
- The failure-mode surface is non-trivial: partial downloads, cleared storage, stale-data detection, version migrations, parsing errors mid-stream.
- IndexedDB itself has a learning curve and quirky cross-browser behavior.

**A small backend that serves preprocessed JSON, refreshed on a cron.** A Vercel serverless function with a KV cache, refreshed periodically. Seriously considered (and arguably more elegant). Rejected for v1 because:

- Nightly rebuilds give 24h staleness on weekly-changing data — user-indistinguishable from continuous freshness.
- Adding even a "small" backend means deployment config, observability, security review, rate-limit considerations, and one more thing that can fail.
- See ADR-0001 for the broader "no backend in v1" reasoning. When the v2 backend exists, migrating static GTFS to it makes sense — but doing it *just* for static GTFS now is building infrastructure ahead of where it pays off.

## Consequences

**Pros:**

- Fastest possible cold-open: schedule data is already in the bundle, precached by the service worker. Zero network cost after first install.
- Offline-by-default for schedule data. Real-time data degrades gracefully, schedule data does not need to.
- No backend to operate. Deploy = static assets to CDN.
- Build failures (e.g., MARTA's static feed is down at build time) are loud and *block* deploys. We never ship a broken app.

**Cons:**

- App data is **frozen between builds**. If MARTA pushes a same-day emergency schedule change, the app doesn't pick it up until the next nightly build (worst case ~24h).
- The webapp can't reflect schedule changes without a redeploy. Hot-fixing data requires triggering a rebuild.
- Static GTFS download happens on every nightly build (~30 MB transfer) — negligible cost, but worth noting.

**Mitigations:**

- 08:00 UTC nightly fires before commute time year-round. By the time the first commuter checks the app at 5–6am ET, the data is fresh.
- If a nightly build fails (e.g., MARTA's feed briefly unavailable), the previous deploy stays live. No outage — just one extra day of staleness.
- Daily rebuilds (chosen over weekly) compress the worst-case staleness window from 7 days to 24h at essentially zero added CI cost.

## Revisit when

- We're standing up a backend in v2 for other reasons (push notifications, accounts, historical reliability). At that point, migrate static GTFS serving to the backend (superseding this ADR) so the backend's first deployment ships visible value across multiple purposes.
- MARTA starts making sub-daily static GTFS changes (unlikely — GTFS is by nature batch-published).
- Vercel build times grow significantly (currently well under a minute; nightly rebuilds remain cheap).
- We get user complaints about stale schedule data (almost certainly won't happen at the 24h ceiling).
