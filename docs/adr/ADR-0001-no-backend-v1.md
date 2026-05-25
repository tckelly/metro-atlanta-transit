# ADR-0001: No backend in v1

**Status:** Superseded by [ADR-0005](./ADR-0005-minimal-backend-proxy.md) (partial — realtime only; the no-backend stance still holds for user state and static GTFS)
**Date:** 2026-05-23

## Context

Atlanta Transit is a Progressive Web App that needs MARTA's real-time bus data (cancellations, predicted arrivals, vehicle positions) and static schedule data (stops, routes, scheduled trip times). Both are available as public APIs without authentication. We need to decide whether to introduce server-side infrastructure — even a small one — between the browser and MARTA's feeds.

The choice has cascading consequences. A backend opens up many product capabilities (push notifications, user accounts, cross-device favorite sync, historical reliability tracking, server-side aggregation, rate-limit-friendly proxying). But it also adds infra to deploy, monitor, secure, and maintain — costs that scale with our willingness to operate them, not with our user count.

## Decision

**v1 ships with no backend.** The PWA is hosted as static assets on Vercel; the browser fetches MARTA's GTFS-Realtime feeds directly; persistence is `localStorage` + the service worker cache; static GTFS is preprocessed at build time and bundled with the app (see ADR-0004).

## Alternatives considered

**A small backend just for static GTFS.** A Vercel serverless function that periodically refreshes static GTFS, caches the result in a KV store, and serves it to the webapp. Rejected for v1 because nightly rebuilds bound staleness to 24 hours, and MARTA only changes static GTFS roughly weekly — so the user-visible benefit of a backend *for this purpose alone* is marginal. Doing it just for static GTFS in v1 amounts to building backend infrastructure ahead of where it pays off.

**Full backend with auth, persistence, and push.** Would enable user accounts, push notifications, cross-device sync, and server-side aggregation. Rejected for v1 because none of those features are in v1 scope (see `product-requirements.md`), and the infra investment is meaningful: deployment config, observability, security hardening, rate limiting, abuse mitigation.

**Server-side aggregation of real-time data.** A backend that polls MARTA and pushes updates to clients via Server-Sent Events or WebSockets, reducing the number of clients hitting MARTA directly. Rejected because at our scale browser-direct polling is fine, and a single backend IP risks getting rate-limited by MARTA more easily than 100 individual browsers ever would.

## Consequences

**Pros:**

- Zero infra to maintain. Deploy = static assets to a CDN. No server health to monitor, no scaling concerns, no environment variables to secure.
- The app can fail in fewer ways. The only thing that can break it (beyond a Vercel outage) is MARTA's own APIs going down — and we degrade gracefully to last-cached data in that case.
- Vercel free tier is sufficient indefinitely at our expected scale.
- Build failures (e.g., bad static GTFS download) are loud and block deploys — no half-broken state reaches production.

**Cons:**

- Features that require server state are not possible in v1: push notifications, user accounts, cross-device favorite sync, historical reliability tracking.
- Static GTFS freshness is bounded by deploy cadence (nightly), not by demand. Acceptable trade-off because MARTA updates static GTFS roughly weekly.
- All API requests come from each user's browser directly. If MARTA ever starts rate-limiting aggressively, we have less ability to consolidate traffic.

## Revisit when

- Any deferred feature (push, sync, historical reliability) becomes a v2 priority. The first backend deployment should ship a user-visible feature, not just be a "neat optimization" that doesn't move user outcomes.
- We hit MARTA rate limits or otherwise need to consolidate API traffic.
- Users specifically request features that require server state.

When that day comes, the backend should also take over static GTFS serving (superseding ADR-0004), so the first deployment of backend infrastructure earns its keep across multiple purposes.
