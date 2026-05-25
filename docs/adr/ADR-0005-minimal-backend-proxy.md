# ADR-0005: Minimal backend proxy for MARTA realtime

**Status:** Accepted
**Date:** 2026-05-24

## Context

ADR-0001 set "no backend in v1" as the architectural baseline: the PWA would fetch MARTA's public GTFS-Realtime feeds directly from the browser. That assumption broke during the first dogfood pass at the end of M1.

**MARTA's GTFS-RT endpoints do not send `Access-Control-Allow-Origin` headers.** The server responds with `200 OK` and a valid protobuf body, but the browser blocks the response from reaching JavaScript before our code ever sees it. We discovered this only when running the app in a real browser — `curl` had succeeded all along, which is what most of the data-layer development used.

We worked around this in dev with a Vite proxy (`vite.config.ts:9-19`): the dev server rewrites `/api/marta/*` to MARTA's hostname server-to-server, sidestepping CORS. That fix is dev-only — Vite is not running in production. Without a production analogue, the deployed app cannot fetch realtime data at all.

We need a path forward that:
- Unblocks browser fetches in production
- Keeps the architectural simplicity ADR-0001 was after — one moving piece, not five
- Doesn't quietly grow into "the backend" by accretion

## Decision

**Ship a minimal serverless proxy on Vercel for MARTA's GTFS-Realtime endpoints.** Two Edge Functions — `tripupdates` and `vehiclepositions` — that each fetch the corresponding MARTA URL server-side and stream the protobuf body back to the client with a short edge-cache TTL.

Concretely:

- `packages/web/api/marta/tripupdates.ts` and `packages/web/api/marta/vehiclepositions.ts` are Vercel Edge Functions (`runtime = 'edge'`). They share a `_proxy.ts` helper with TDD coverage for the failure modes (upstream 5xx, network failure, content-type passthrough).
- The client (`services/martaRealtime.ts`) hits `/api/marta/...` in **both** dev and prod. The Vite dev proxy and the Vercel functions present the same URL surface, so no environment branching in the client.
- Edge cache: `Cache-Control: s-maxage=10, stale-while-revalidate=30`. The browser still polls every 60s, but multiple clients in the same region collapse onto one upstream call per ~10s. Polite to MARTA, faster for users.
- **Static GTFS stays at build time for now.** ADR-0004 is not superseded. The M5 roadmap mentioned moving static GTFS to the backend alongside this proxy, but the static feed only changes weekly and the current nightly-rebuild model works; coupling that migration into this change would balloon scope without user-visible benefit. Move it in v2 (or earlier if it earns its keep).

ADR-0001's status is updated to **"Superseded by ADR-0005 (partial)"** — the "no backend" goal still applies to user state (favorites, history, accounts) and static GTFS serving. Only the realtime fetch path moves server-side.

## Alternatives considered

**Keep the dev-only Vite proxy and ship without a production proxy.** Rejected — the app cannot load realtime arrivals in production. This is the primary feature.

**Public CORS-proxy services (e.g., corsproxy.io, allorigins.win).** Rejected — these are third-party dependencies for a load-bearing data path. Free tiers throttle, terms of service change, and any of them disappearing breaks the app silently. Owning ~30 lines of proxy code is cheaper than the ops risk.

**Server-side aggregation: one backend instance polls MARTA, fans out to clients via SSE/WebSockets.** Same rejection as ADR-0001 — at our scale this is over-engineering, and a single backend IP is *more* likely to get rate-limited by MARTA than N individual browsers behind a 10-second edge cache.

**Browser extension or service-worker CORS bypass.** Service workers cannot bypass CORS for requests they didn't initiate, and we are not shipping a browser extension. Non-starter.

**Run `vercel dev` locally instead of Vite proxy.** Would unify dev and prod behavior at the cost of a heavier dev tool. Rejected for now — Vite's HMR is faster, and the surface area we'd be unifying is exactly two URLs serving the same passthrough. Worth revisiting if the proxy grows.

## Consequences

**Pros:**

- Production-deployable. Realtime data works on any device, not just `localhost`.
- Same URL shape in dev and prod (`/api/marta/...`) — no `import.meta.env.DEV` branching in the client.
- Edge cache is courteous to MARTA: N concurrent users → 1 upstream request per ~10s, regardless of how many tabs are open.
- Surface area is tiny: two handlers and one shared helper. The helper is unit-tested for failure modes (upstream 5xx, network errors, missing content-type).
- Vercel free tier covers the call volume comfortably (the polling rate is fixed at ~1/min per active client).

**Cons:**

- We now have server-side code to deploy, monitor, and (rarely) debug. Bus factor on the proxy is one person.
- Vercel Edge cold-start adds latency on the first request after idleness. Acceptable because realtime polling warms it quickly.
- If MARTA changes its endpoint paths or response format, both the proxy and the client need updating in lockstep — small risk because the proxy is dumb (no parsing on the server).
- The proxy is a small but real attack surface. We don't accept any user-supplied input on it (URL is hard-coded), so the surface is "open relay for two specific upstream URLs" — minimal abuse potential.

## Revisit when

- Static GTFS migration becomes valuable (e.g., when nightly freshness isn't enough, or when v2 backend features land and the proxy can earn extra keep). At that point the proxy graduates into a small backend, and ADR-0004 also gets superseded.
- Push notifications, accounts, or any other server-state feature lands in v2. The backend's role changes from "proxy" to "service" and warrants a new ADR.
- The proxy starts seeing abuse (open-relay style amplification, unusual traffic patterns). At that point we'd add light rate-limiting or origin checks; both are out of scope today.
