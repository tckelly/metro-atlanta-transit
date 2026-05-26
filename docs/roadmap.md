# Roadmap

What gets built in what order, and what "done" looks like at each step. Organized by **milestone**, not by calendar week — schedules slip, dependencies don't.

## North star (one-line reminder)

A PWA that answers *"is my bus actually coming?"* in under two seconds from cold open. v1 ships the three jobs (live arrivals, route disruption signal, nearby stops) for metro Atlanta bus commuters with no backend, no accounts, no notifications. See `vision.md`.

## Versioning

We're pre-stable. Semver's `0.x.y` space says "developing, breaking changes allowed" — that's exactly where we are.

- **v0.0.1** — first launch ("v1" in this doc and prior conversation). What M0–M7 produce.
- **v0.0.2 → v0.0.N** — successive post-launch iterations. Each milestone-significant release bumps the patch level while we're still iterating on real-world feedback.
- **v1.0.0** — first *stable* release. Declared only when (a) the v1 jobs are battle-tested across a meaningful user base, (b) the API / UX surfaces are something we'd commit to keeping stable, and (c) we'd be comfortable users link to and depend on the app.

Continuing to patch-bump (instead of jumping to `0.1.0` or `1.0.0`) keeps the signal honest: this is still software being shaped by its first users, not a mature product. The conversation's earlier shorthand of "v1 / v2" maps to "v0.0.1 / v0.0.2" without ambiguity.

## v1 — the milestones

Each milestone has a definition-of-done. Milestones are *roughly* sequential, but the dependencies are what bind them — re-order freely where deps allow.

---

### M0 — Foundations (engineering only)

Set up the workspace and confirm the deploy pipeline before any product code lands.

**Done when:**

- pnpm workspace initialized with the four packages (`web`, `components`, `gtfs`, `utils`).
- Shared `tsconfig.base.json`, ESLint config with `eslint-plugin-boundaries`, Tailwind preset exported from `components`.
- Vite dev server runs in `packages/web`; renders a placeholder.
- Vercel deploys the placeholder from `main` on push. Custom domain optional.
- GitHub Actions workflow exists for lint + typecheck + test on PR (even though nothing meaningful runs yet).

**Why first:** the cost of getting tooling wrong scales with how much code is on top of it. Lock the foundation while the codebase is empty.

**Depends on:** nothing.

---

### M1 — Data plumbing

The full data pipeline working end-to-end, tested, *with no UI*. Most of the business logic complexity lives here.

**Done when:**

- `@atl-transit/gtfs` decodes real `vehicle_positions.pb`, `trip_updates.pb`, and `alerts.pb` into typed objects. `sample-data/marta-gtfs-rt-2026-05-22/*.pb` serve as test fixtures.
- `scripts/preprocess-gtfs.ts` downloads, parses, and emits trimmed JSON. Wired into `pnpm --filter @atl-transit/web prebuild`.
- `services/martaRealtime.ts`, `services/gtfsStatic.ts` working in `packages/web`. Zod schemas validate external data on read.
- `useArrivals(stopId)` hook returns the discriminated state shape (`loading | success | error | empty`) with live ETA / cancelled / no-live-data classification per ADR-0004's data shape.
- Polling lifecycle works: 30s when visible, pauses on tab blur, cancels on unmount, shared cache prevents duplicate fetches.
- The status-classification logic is fully unit-tested. *This is the business-logic core.*

**Why before UI:** if the data layer is solid, the UI is a thin shell. If the data layer is leaky, every UI feature has to compensate.

**Depends on:** M0.

---

### M2 — First vertical slice: stop detail (Job 1, basic)

The first user-visible thing. Not pretty yet, but functionally complete for *one* stop view.

**Done when:**

- `BusRow` component exists in `@atl-transit/components` with all four visual variants (live on-time, live delayed, cancelled, no-live-data). Storybook-style isolated rendering works (we won't ship Storybook, but components must render in isolation in dev).
- `packages/web/src/features/stops/` has the domain-to-visual mapper (`busRowMapper.ts`) per ADR-0003.
- A `/stop/:stopId` route renders live arrivals for any stop, grouped by route, with route headsigns from static GTFS.
- "Last updated N sec ago" indicator works including its three freshness states.
- Auto-refresh and pull-to-refresh both work.
- Occupancy status displays when present, omitted when absent.
- **Dogfoodable.** You can manually URL into `/stop/<favorite-stop-id>` and use it for your morning commute.

**Why this slice:** Job 1 is the dominant job. Getting it functional end-to-end early — even with rough edges — proves the architecture works and starts producing real-world signal.

**Depends on:** M1.

---

### M3 — Home: favorites view (Job 1, complete)

Make the stop detail reachable without typing URLs.

**Done when:**

- `services/storage.ts` with Zod-validated localStorage for favorites (max 10).
- `FavoritesContext` exposes add/remove/list operations.
- Star toggle on stop detail.
- Home screen (`/`) renders the favorites list as stop cards, each showing the next 1–2 buses with status.
- Empty state when no favorites yet, with a clear CTA toward nearby stops or browse-routes.
- Adding/removing a favorite has an undo toast.

**Done means:** the commute workflow works from a cold open. Open app → see favorites → tap → see arrivals.

**Depends on:** M2.

---

### M4 — Nearby stops (Job 3) + route disruption indicator (Job 2)

The two remaining v1 jobs.

**Done when:**

- `services/geolocation.ts` wraps the browser API with explicit permission handling and graceful denial.
- In-app permission explanation screen ("Find stops near you") shows *before* the browser prompt fires.
- Nearby stops list on the home screen, sorted by walking distance (Haversine), top 5.
- Distance shown as walking minutes, not raw meters.
- Route disruption signal: soft warning at 1 cancellation in next 5 trips at a stop, strong warning at 2+. Thresholds live in a constants module.
- Browse-by-route entry point (the "should-have" feature) and route detail view.

**Done means:** all three jobs from `personas-and-jobs.md` work end-to-end.

**Depends on:** M3 (for the home screen shell). M4 internal items can ship in any order.

---

### M5 — Polish, accessibility, PWA, i18n, **and the backend proxy**

The "this is shippable, not just functional" pass. Now includes a small backend, which became necessary once CORS testing revealed MARTA's realtime endpoints don't allow browser-direct fetches (originally assumed in ADR-0001). Dev currently uses a Vite proxy as a stopgap.

**Done when:**

- Accessibility audit completed: keyboard nav, screen reader on three core flows, WCAG 2.2 AA contrast verified in both light and dark modes, ARIA live regions on the "last updated" indicator and disruption badges.
- Dark mode QA on every screen.
- All user-facing strings in `i18n/en.json` and `i18n/es.json`. Spanish translations reviewed (ideally by a native speaker; minimally by careful review against a glossary).
- Error boundaries at every route. Network failure, geolocation denial, static GTFS missing all have explicit UX states.
- Loading skeletons on first load; subtle progress indicator on refresh; no full blanking.
- Service worker configured via `vite-plugin-pwa`: precache app shell + GTFS bundle, NetworkOnly with 5s timeout + cache fallback for real-time.
- "Add to Home Screen" prompt on second visit (Android), iOS install instructions.
- Theme bootstrap script in `index.html` prevents flash-of-wrong-theme.
- Settings screen complete (theme, language, About, attribution, disclaimer, version).
- Scheduled rebuild cron (`.github/workflows/nightly-rebuild.yml`) at 08:00 UTC.
- **Backend proxy** (Vercel serverless function) proxies MARTA's GTFS-RT feeds, replacing the dev-only Vite proxy. Same shape as the existing `martaRealtime.ts` client; adds short edge caching for politeness. Documented in a new ADR that supersedes ADR-0001.
- Static GTFS migrated to the backend at the same time (supersedes ADR-0004), so the deploy is self-contained and the data is continuously fresh rather than nightly-rebuilt.

**Done means:** shippable to strangers, not just to yourself.

**Depends on:** M2, M3, M4 (whatever they cover gets polished here).

---

### M6 — Launch prep

The pre-flight checks before any public link goes out.

**Done when:**

- `README.md` with screenshots, setup instructions, contribution guide.
- Screenshots taken on actual phones (iOS Safari + Android Chrome).
- Legal pages confirmed: "Not affiliated with MARTA" disclaimer in Settings, "Data provided by MARTA" attribution. No use of MARTA logo or name in app branding.
- Privacy: no analytics by default in v1 (we have no backend to collect anything; if we add analytics, it's privacy-friendly like Plausible). Decision documented.
- License: MIT in repo root.
- Final dogfood week — use it for *every* commute, fix bugs as they surface. No "but it usually works" excuses.
- Custom domain pointed at Vercel.

**Done means:** ready to post to r/Atlanta and r/MARTA.

**Depends on:** M5.

---

### M7 — Soft launch

The public reveal, scaled to expectations.

**Done when:**

- Reddit posts on r/Atlanta and r/MARTA, framed as "frustrated commuter built a thing, feedback welcome." Per the spec's template: honest, humble, not overselling.
- First-day monitoring: refresh logs, watch for reports of broken stops, broken routes, crashes.
- Hotfix readiness: you can deploy a fix within an hour of seeing a critical issue.
- Response plan for comments: reply to feedback within 24h for the first week.

**Done means:** v1 is live, in real users' hands, generating signal.

**Depends on:** M6.

---

## v1 launch criteria (the gate before M7)

These must all be true before any public link goes out. Treat as a non-negotiable checklist.

- [ ] All three jobs work end-to-end on an actual phone (not just the dev's MacBook).
- [ ] Cold-open to first useful answer in under 2 seconds on mid-range Android over 4G. Measured, not assumed.
- [ ] Zero unhandled errors in production. Every async state has loading/success/error/empty.
- [ ] Dark mode works on every screen with verified contrast.
- [ ] Both languages render fully without English fallback for shipped strings.
- [ ] Accessibility audit complete on the three core flows.
- [ ] App installable as a PWA on iOS and Android.
- [ ] Used by the dev for 5+ consecutive commutes without a critical bug surfacing.
- [ ] Disclaimer and attribution visible in Settings.
- [ ] README clear enough that a stranger could clone and run locally.

---

## First two weeks post-launch (the iteration plan)

The roadmap doesn't end at launch — it continues with whatever the world tells us. Plan to **expect surprises**, not to execute a pre-baked feature list.

**Week 1:**

- Triage every reported bug within 24h.
- Hotfix path: small bugs ship same-day; bigger issues get a fix branch and a quick PR.
- Monitor: do users report things we already know? Or unknown unknowns? The ratio tells you something.
- No new features unless a bug fix naturally pulls one in.

**Week 2:**

- Reconcile the route disruption thresholds (the heuristic from `product-requirements.md`) against real-world cancellation patterns we've now observed.
- Reconcile the "2-second cold-open" target against real-world device data.
- Identify the top 2-3 user-requested features and decide for each: ship in v1.x, defer to v2, or never.

If after two weeks the app is stable and the feedback loop is healthy, declare v1 done and start the v2 conversation.

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

### Polling cadence tuning (v0.0.2 candidate, ~5-minute change)

**What.** Drop `POLL_INTERVAL_MS` from 60 s → 90 s.

**Why.** ~33% reduction in per-user bandwidth and function invocations. MARTA's own pipeline is already 5–15 s behind ground truth, so an extra 30 s on our side is within noise.

**Trigger.** Same as above, or simply "no real user feedback says 60 s feels essential."

**Cost.** One constant, one test update. Trivially revertable.

### Background-bfcache friendliness

**What.** Investigate whether `vite-plugin-pwa`'s service-worker registration is preventing the browser's back/forward cache (Lighthouse flagged this in earlier audits — partly the HMR WebSocket in dev, but the SW registration may also disqualify the page in some browser/version combinations).

**Why.** bfcache makes back-button navigation feel instant. If the SW is disqualifying us, fixing it is a clean UX win at zero recurring cost.

**Trigger.** Real-device M6 audit confirms the issue persists in the production bundle.

**Cost.** Investigation 1–2 hours; fix could be anything from a vite-plugin-pwa config flag to a deferred-registration tweak.

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

- Rail integration (re-evaluate scope vs. Terminus app's coverage).
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
