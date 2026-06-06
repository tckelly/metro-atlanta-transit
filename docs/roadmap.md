# Roadmap

The forward view: what's queued next and where it sits on the time horizon. v0.0.1 shipped 2026-05-31 — its milestone plan, launch criteria, and first-two-weeks iteration plan are archived verbatim in [`history/v0.0.1.md`](./history/v0.0.1.md). This doc covers v0.0.2 onward.

## North star (one-line reminder)

A PWA that answers *"is my bus actually coming?"* in under two seconds from cold open. v1 ships the three jobs (live arrivals, route disruption signal, nearby stops) for metro Atlanta bus commuters with no backend, no accounts, no notifications. See `vision.md`.

## Versioning

We're pre-stable. Semver's `0.x.y` space says "developing, breaking changes allowed" — that's exactly where we are.

- **v0.0.1** — first launch ("v1" in this doc and prior conversation). What M0–M7 produce.
- **v0.0.2 → v0.0.N** — successive post-launch iterations. Each milestone-significant release bumps the patch level while we're still iterating on real-world feedback.
- **v1.0.0** — first *stable* release. Declared only when (a) the v1 jobs are battle-tested across a meaningful user base, (b) the API / UX surfaces are something we'd commit to keeping stable, and (c) we'd be comfortable users link to and depend on the app.

Continuing to patch-bump (instead of jumping to `0.1.0` or `1.0.0`) keeps the signal honest: this is still software being shaped by its first users, not a mature product. The conversation's earlier shorthand of "v1 / v2" maps to "v0.0.1 / v0.0.2" without ambiguity.

## Post-launch polish backlog

Smaller product items deferred from v0.0.1 — surface in v0.0.2 as bandwidth and adjacent feedback allow. No trigger conditions; these are taste/clarity calls, not evidence-gated.

### Match BusRow severity colors on live downstream times — **deferred 2026-06-01**

The BusRow uses status color to telegraph timing (green early/on-time, yellow slight delay, red late/cancelled). The disclosure currently renders all per-stop times in `text-fg-muted` regardless of how each prediction compares to schedule. Carry the same severity down per-stop: compute `delaySec = predictedArrivalTime - scheduledTime` per downstream stop, classify via the same thresholds the row classifier uses, and color the time accordingly. Blocker: scheduled times currently only ride the scheduled-path fetch — either fold scheduled into the live mapper, or have the disclosure merge both when both are available. Naturally pairs with the scheduled-path-times item below.

**Files:** `packages/web/src/features/stops/BusRowDisclosure.tsx`, the row classifier, plus whichever mapper acquires the scheduled-time merge.

**Deferral note.** Investigated 2026-06-01 and decided not to ship. The row-level severity color is the dominant signal — riders open the disclosure to confirm "is my target stop on this branch?", not to inspect per-stop timing divergence. MARTA's realtime predictions propagate delay roughly linearly across a trip's downstream stops, so per-stop coloring would mostly restate the row-level signal. The cost is non-trivial: live rows currently derive downstream stops in-memory with zero backend cost on disclosure open; per-stop severity requires fetching the trip's static schedule (`/api/gtfs/trip-stops`) to obtain `scheduledTime` for the delay computation. Adding that fetch on every live disclosure open runs against the bandwidth-reduction motivation behind the *Server-side trip-update filtering* and *Polling cadence tuning* candidates below. Revisit only if real user feedback specifically asks for per-stop timing detail in the disclosure.

### Scheduled-path downstream times + `arrivalText` rename — **shipped 2026-05-31 (v0.0.2)**

The scheduled / no-live / cancelled disclosure paths render name-only — they had no time data at launch. The work: add `TripStopWire.scheduledTime` to the wire schema, have `queryStopsForTrip(tripId, date)` select `arrival_time` and convert via `gtfsTimeToUnixSec`, rename `predictedArrivalText` → `arrivalText` on the client, and fall back `predictedArrivalTime ?? scheduledTime` in the formatter. Unblocks the severity-coloring item above.

**Files:** `packages/web/api/gtfs/trip-stops.ts`, `packages/web/src/features/stops/BusRowDisclosure.tsx`, and the relevant Zod schema / formatter modules.

**As-shipped notes.** Implemented as one PR with two logical commits (data-path + UI). Backend handler now also requires a `date=YYYYMMDD` query param; the existing `s-maxage=300` edge cache stays valid because real users only ever ask for today's date. `InMemoryGtfsRepository` mirrors the conversion so dev mode matches prod. Service-date logic that was inlined in `useArrivals` was lifted to a shared `utils/serviceDate.ts` so the disclosure call site can stay in sync with what "today" means in `America/New_York`. Verified on a scheduled bus with no live data — clock times now render in the disclosure.

---

## Post-launch optimization candidates

Items identified during v0.0.1 development that don't ship in the launch build but are worth revisiting once real usage data exists. Each lists what, why, the trigger condition that justifies the work, and rough cost. Promote to a real implementation pass — with its own ADR at the time of commitment — only when the trigger fires. Until then, these stay aspirational so we don't optimize ahead of evidence.

### Server-side trip-update filtering (v0.0.2 candidate)

**What.** Replace the byte-pass-through `/api/marta/tripupdates` proxy with a function that decodes the protobuf server-side, filters to the client's requested stop IDs, and returns ~5–20 KB JSON instead of MARTA's ~1 MB full-system protobuf.

**Why.** MARTA's GTFS-RT feed is system-wide — every active trip in every route in a single payload, ~1 MB per poll. With 60-second polling on `StopDetail`, that's ~1 MB/minute per connected user; ~10 MB across a typical 10-minute commute on cellular. The vast majority is data about stops the user isn't looking at. The edge cache (ADR-0005) collapses upstream MARTA fetches across users but doesn't reduce per-user download size.

**Approach.** Stays within the current stateless-functions + edge-cache architecture. The function decodes the protobuf, caches the decoded result in *module-scope memory* for ~30 s, and filters per request. **No new infrastructure** — no Vercel KV, no database, no WebSocket / SSE streaming, no user accounts.

**Bonus side effects:**
- The client no longer needs the protobuf decoder. `@atl-transit/gtfs` runs server-side only, shrinking the client bundle.
- `tripupdates` and `vehiclepositions` could merge into a single endpoint that returns both in one response — one fewer round-trip per poll.
- Per-request cost stays low: one MARTA fetch per cache window regardless of how many clients ask.

**Trigger condition.** Post-launch usage shows cellular-data complaints, *or* analytics confirms >10 MB/session is common, *or* function GB-hours / outbound bandwidth approach Hobby-tier limits.

**Rough cost.** 1–2 days with TDD. The decode-and-filter logic is a pure function (testable in isolation); the cache-window timing is testable with fake timers; the HTTP handler is a thin wrapper.

**Note on client-side perf work.** A Lighthouse audit during v0.0.1 surfaced ~85 KiB of unused JavaScript in the entry bundle, partly attributable to the protobuf decoder and MARTA fetch helpers being eagerly imported by `RealtimeFeedProvider`. We considered lazy-loading those modules client-side, but decided to wait — server-side filtering would move the decoder off the client entirely, so the lazy-loading work would be redundant. Implementing this filtering pass first lets us measure the post-filtering bundle and revisit any remaining client-side optimization with better information.

### Polling cadence tuning (v0.0.2 candidate, ~5-minute change) — **deferred 2026-06-01**

**What.** Drop `POLL_INTERVAL_MS` from 60 s → 90 s.

**Why.** ~33% reduction in per-user bandwidth and function invocations. MARTA's own pipeline is already 5–15 s behind ground truth, so an extra 30 s on our side is within noise.

**Trigger.** Same as above, or simply "no real user feedback says 60 s feels essential."

**Cost.** One constant, one test update. Trivially revertable.

**Deferral note.** Considered 2026-06-01 and held. This is a solo hobby project with effectively zero users on day one of launch — there is no meaningful bandwidth or invocation cost to reduce, and no UX signal saying 60 s feels too fast or too slow. Changing the constant now would be evidence-free optimization against an imaginary load profile. Revisit if/when real usage data shows function invocations or outbound bandwidth trending toward Hobby-tier limits, or if a user reports the refresh cadence feels off.

### Background-bfcache friendliness

**What.** Investigate whether `vite-plugin-pwa`'s service-worker registration is preventing the browser's back/forward cache (Lighthouse flagged this in earlier audits — partly the HMR WebSocket in dev, but the SW registration may also disqualify the page in some browser/version combinations).

**Why.** bfcache makes back-button navigation feel instant. If the SW is disqualifying us, fixing it is a clean UX win at zero recurring cost.

**Trigger.** Real-device M6 audit confirms the issue persists in the production bundle.

**Cost.** Investigation 1–2 hours; fix could be anything from a vite-plugin-pwa config flag to a deferred-registration tweak.

---

## Next-up major features (v0.0.2+)

Distinct from the polish backlog and optimization candidates above: these are new product capabilities under active design. Each has its own design doc in `docs/features/`; this section is the time-ordering pointer.

### Service alerts surfacing — design in [`features/alerts.md`](./features/alerts.md)

Surface MARTA's `alerts.pb` feed (planned detours, station closures, weather-driven changes). The decoder shipped in M1 but nothing in the UI consumes it. v0.0.1's "route disruption signal" is cancellation-derived heuristics, not the agency's own message — alerts adds the missing channel.

**Status.** Design open. Data path exists end-to-end up to the decoder; UI placement and noise/relevance filtering are the unresolved questions.

### Real-time rail — design in [`features/rail.md`](./features/rail.md)

Promoted out of v2 Tier 3. MARTA Rail has a separate API (free, registration-gated) covering the 4 heavy-rail lines. Different shape from the bus GTFS-RT feeds — JSON not protobuf, separate auth model, almost certainly needs a backend proxy that composes with the bus backend.

**Status.** Design open, gated on registering for the API key to learn the data shape. Until that lands, the UX questions are speculative.

---

## v2 horizons

What's *next* after v1, in rough priority order. Each gets a deeper conversation when v1 stabilizes.

### Tier 1 — high user value, requires backend

These together justify standing up the v2 backend:

- **Push notifications** for favorite-route disruptions. The biggest "I wish this app had…" feature for commuters.
- **Account-free cross-device sync** for favorites (anonymous user ID stored in localStorage, server holds the favorites list).
- **Historical reliability data** — "Route 36 has been cancelled 14% of the time in the last 30 days." Genuinely useful product differentiation.
- **Move static GTFS to the backend** (supersedes ADR-0004). With a backend now extant, this becomes a real-time-fresh data source instead of a nightly snapshot.

### Tier 2 — high value, no backend required

- **Map view.** Bundle weight cost is real; only build if usage data shows demand.
- **`TranslatedString` decoder** if MARTA starts populating those fields (see open question #5 in `data-and-apis.md`).

> *Stop search by name* was originally listed here. It graduated to v1 during M5 after dogfood showed browse-by-route alone was too clunky — see `product-requirements.md`.

### Tier 3 — speculative

- Capacitor wrapper for App Store presence.
- Trip history / commute tracking.
- Crowdsourced bus fullness reports.

### Out of scope, period

- Multi-leg trip planning (Google Maps owns this).
- Generic transit app for other cities (we are Atlanta-focused on purpose).
- Real-time vehicle tracking on a map *as a primary feature* (it can be a secondary view but not the headline UX).

---

## What this doc is *not*

- It's not a *schedule*. The spec's "6-8 week timeline" is a useful sanity check, not a commitment. Milestones happen when they happen.
- It's not a *contract*. Re-ordering is fine when reality demands it. Just keep `vision.md` and `product-requirements.md` as the source of truth on *what*; this doc is about *when relative to what else*.
- It's not exhaustive on v2. Tier 1 / 2 / 3 above are signposts, not promises. Each gets its own conversation when v1 lands.
