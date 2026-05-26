# Product Requirements (v1)

What the v1 app must do, expressed as features with acceptance criteria. Grounded in `vision.md` (the "why"), `personas-and-jobs.md` (the "who" and "what they're trying to accomplish"), and `data-and-apis.md` (what we can actually build).

## How to read this doc

Each feature has a **priority**:

- **Must-have** — v1 doesn't ship without it.
- **Should-have** — v1 ideally ships with it; cut only if late and required to ship.
- **Won't-have (v1)** — explicitly deferred. Listed at the end with the v2 path.

Acceptance criteria are written as testable assertions. They are the contract for "done."

---

## Core feature: Live arrivals for a stop *(Must-have, Job 1)*

The dominant feature. Everything else is supporting infrastructure.

**Description:** When the user opens a stop, they see the upcoming buses scheduled to serve it — including cancelled ones, clearly marked — with live ETAs where available.

**Acceptance criteria:**

- Shows all scheduled buses for the stop within a forward window (default: next 60 minutes).
- Each bus row displays: route short name (e.g., "36"), destination headsign, scheduled time, and a **status**: `Live • X min`, `Cancelled`, or `No live data` (fallback to scheduled time).
- Cancelled buses are visually distinct (strikethrough, muted color, clear "Cancelled" label) but **not hidden**. The user must never wonder if the list is complete.
- When `occupancyStatus` is present on the matching vehicle, display it as a human-readable indicator (e.g., "Seats available," "Standing room only"). Omit when absent — never invent or interpolate.
- Auto-refresh every 30 seconds while the view is foregrounded.
- "Last updated N seconds ago" is visible and updates live.
- When auto-refresh fails (network error), the data displayed stays put, the "Last updated" timestamp goes stale, and a clear "Couldn't refresh — data is N min old" indicator appears.
- Pull-to-refresh forces an immediate fetch.
- Polling pauses when the view is backgrounded (tab blur, PWA backgrounded) and resumes on focus.

---

## Core feature: Favorites *(Must-have, supports Job 1)*

**Description:** The user can pin frequently-used stops so they appear immediately on the home screen without geolocation or search.

**Acceptance criteria:**

- A user can favorite/unfavorite a stop from the stop detail view (tap a star icon).
- Favorites persist across sessions in `localStorage`.
- Maximum of 10 favorites; the UI prevents adding an 11th and explains why.
- Favorites appear on the home screen, in the order the user added them, above the "Nearby stops" section.
- Each favorite card on the home screen shows: stop name, the next 1–2 buses with status (using the same status conventions as the full stop view).
- Removing a favorite is recoverable for the current session (undo toast).
- No login or account is required. Favorites are device-local.

---

## Core feature: Nearby stops *(Must-have, Job 3)*

**Description:** When the user opens the app away from their usual stops, they see nearby stops with live arrivals already loaded.

**Acceptance criteria:**

- On first visit, the app requests geolocation permission with a clear in-app explanation *before* the browser prompt fires ("We use your location to show nearby stops. Location stays on your device.").
- If permission is granted: show the 5 nearest stops, sorted by walking distance (Haversine), with the next bus per route at each stop visible without an extra tap.
- If permission is denied: show favorites (if any) and an empty state with a "Browse routes" entry point.
- If permission is granted but location lookup fails (no signal, timeout): show favorites and a "Couldn't find your location — try again" affordance.
- Distance is shown as walking minutes (assume 4.5 km/h average pace), not raw meters.
- Nearby stops do *not* poll on the home screen — they fetch once on view open. Tapping a stop opens the detail view (which does poll). Rationale: the home screen is a directory, not a live dashboard.

---

## Core feature: Route disruption indicator *(Must-have, Job 2)*

**Description:** When a route is having a bad day (multiple cancellations), the user sees it at a glance — before they leave home.

**Acceptance criteria:**

- For each route appearing on a stop view or favorites card, compute its disruption signal from `trip_updates`: count cancellations among the next 5 scheduled trips on that route at that stop.
- Soft warning (1 cancellation in next 5): subtle yellow indicator on the route row.
- Strong warning (2+ cancellations in next 5): prominent red "Route disrupted" badge on the route.
- The badge is informational, not a separate screen. Tapping it could later link to detail; for v1, hover/tap shows a short tooltip ("3 of next 5 trips cancelled").
- Thresholds (1, 2) are the v1 starting heuristic — to be tuned once we observe real cancellation patterns. Document the chosen values in a constants module so they're easy to adjust.

> Note: this is derived from `trip_updates` aggregation, not from MARTA's (currently empty) alerts feed. See `data-and-apis.md` for rationale.

---

## Core feature: Stop browse by route *(Should-have)*

**Description:** Without geolocation and without an existing favorite, the user can still find a stop by walking the route list.

**Acceptance criteria:**

- A "Browse routes" entry point on the home screen leads to a list of all MARTA bus routes (sorted by route number).
- Tapping a route shows its stops in order, with direction toggles where applicable (e.g., inbound/outbound).
- Tapping a stop opens the stop detail view.

> **Judgment call:** I'm proposing this as Should-have (not Must-have) because the Routine Commuter primarily uses favorites + nearby. But without it, the only way to favorite a new stop is to be physically near it — an awkward cliff. Flagging for your call: keep as Should-have, promote to Must-have, or defer to v2?

---

## Core feature: Stop search by name *(Should-have)*

**Description:** Without geolocation and without an existing favorite, the user can type a stop or street name to find the stop directly. Complements browse-by-route, which requires knowing the route number.

**Acceptance criteria:**

- A search box on the home screen filters all stops by name as the user types.
- Global results are ranked: prefix matches first, then word-boundary matches, then anywhere-substring matches. Source-order tie-break for determinism.
- Each result row shows the stop name and the routes serving it.
- The result list is bounded (currently 20) so the rendered output stays scannable on mobile.
- The same search affordance appears on `/routes` (filter the route list by short name *or* long name) and inside `/route/:routeId` (filter that direction's stops). In-place filtering preserves the page's existing sort order on those views.
- Empty input restores the page's default content; the clear button is keyboard-accessible.

> **Promoted from v2 Tier 2 during M5.** The original deferral assumed browse-by-route would be sufficient for the Occasional Rider. Dogfood revealed browse-by-route is clunky when you know a street name but not the route number — the exact trigger condition the v2 path had called out ("Add if usage shows browse-by-route is too clunky").

---

## Cross-cutting requirements

These apply to every screen and feature.

### Performance *(Must-have)*

- **Cold open to first useful answer in under 2 seconds** on a mid-range Android phone over 4G. This is the headline product promise from `vision.md`.
- First Contentful Paint within 1 second of navigation start.
- Bundle size budget for v1: **under 200 KB gzipped** for the initial JS payload. Static GTFS preprocessed data ships as a separate, lazy-loaded chunk.
- Real-time API responses parsed in a Web Worker if parsing exceeds 50ms on mid-range hardware (this is a P2 optimization to evaluate against real timing — don't prematurely optimize).

### Accessibility *(Must-have)*

- Meet WCAG 2.2 AA on every shipped screen.
- Semantic HTML: `nav`, `main`, `article`, real `<button>` elements.
- Keyboard-navigable: every interactive element reachable via Tab, activatable via Enter/Space.
- Screen-reader tested on the three core flows (favorites view, stop detail, nearby stops).
- Color contrast meeting 4.5:1 for text, 3:1 for UI components.
- Status changes (cancellation, delay) announced via ARIA live regions for screen readers.
- Touch targets minimum 44×44 px.

### Internationalization *(Must-have)*

- English and Spanish only in v1.
- All user-facing strings live in `i18n/en.json` and `i18n/es.json` — no hardcoded English in components.
- Language picker in settings; default to browser language with English fallback.
- Numbers, distances, and times respect the active locale.

### PWA installability *(Must-have)*

- Valid `manifest.json` with icons (192×192 and 512×512), name "Atlanta Transit," display mode `standalone`.
- Service worker that caches static assets and the preprocessed GTFS bundle.
- "Add to Home Screen" prompt (or instructions on iOS) shown on second visit, dismissible.
- App launches and loads cached content even when offline; live data shows "Offline — data is N min old."

### Error handling and offline degradation *(Must-have)*

For every async operation, all four states are explicit: loading, success, error, empty.

- **Real-time feed unreachable:** show last cached real-time data with a prominent "Couldn't refresh" indicator. Never show a blank screen.
- **Geolocation denied:** see Nearby stops criteria.
- **Static GTFS missing (first run + offline):** show an explanatory empty state with retry, not a crashed app.
- **Stop has no upcoming buses:** show "No buses scheduled in the next hour" with the next scheduled bus time if known.
- Errors are isolated by error boundaries at the route level — one broken screen doesn't take down the app.

### Legal *(Must-have)*

- "Not affiliated with or endorsed by MARTA" disclaimer visible in About/Settings.
- No use of MARTA logo or "MARTA" in the app name.
- Attribution: "Data provided by MARTA" in About/Settings.

---

## Won't-have (v1) — explicit deferrals

These are *not* in v1. Listed so we don't accidentally drift into them, and so we have a clear v2 path.

| Feature | Why deferred | v2 path |
|---|---|---|
| Push notifications | Requires backend; v1 is client-only | Once v2 has a backend, push for favorite-route disruption |
| User accounts / cross-device sync | Backend required; favorites work fine in localStorage | Backend with auth |
| Trip planning (multi-leg) | Out of vision scope; Google Maps owns this | Not planned |
| Rail/train arrivals | Out of vision scope; Terminus app handles this well | Not planned |
| Map view | Adds bundle weight; v1 jobs are answered with a list | Consider in v2 if usage data shows demand |
| Service alerts (first-class) | MARTA's alerts feed is empty (see `data-and-apis.md`) | Light up if MARTA starts populating; otherwise inference-only |
| Historical reliability | Requires backend storage of feed snapshots over time | v2 backend feature |
| Vehicle live tracking on a map | Bundle cost + complexity for low marginal value over text ETAs | v2+ |
| Custom decoder for `TranslatedString` fields | MARTA publishes empty content today (see `data-and-apis.md` finding #5 and open question #5) | Build when MARTA starts populating real text |
| `occupancyPercentage` numeric display | `occupancyStatus` categorical is more glanceable | Add if a use case demands precision |

---

## Open questions / decisions needed

1. **Stop browse-by-route as Must-have or Should-have?** See judgment call above. Currently Should-have.
2. **Route disruption thresholds.** Started at 1 cancellation = soft warning, 2+ = strong. Need to validate against real data after using the app for a couple weeks. Tuning is a v1 iteration item, not a launch blocker.
3. **Geolocation polling on stop detail.** Currently the spec says "do not poll for location continuously." Confirm: we use a one-shot fix when the user opens the home/nearby view, not a continuous watch?
4. **Favorites cap of 10.** Is this real or arbitrary? The spec says 10 to prevent clutter. Acceptable for v1; revisit if users push back.
5. **Nearby stops count (5).** Spec suggested 5–10; I went with 5 to keep the home screen scannable. Worth A/B if we ever have analytics.

---

## What this doc is *not*

This is *what* we're building and *how good* it has to be. The visual design and interaction patterns live in `ux-guidelines.md`. The technical implementation lives in `architecture.md` and `adr/`. The launch sequence lives in `roadmap.md`.
