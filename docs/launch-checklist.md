# Launch checklist — v0.0.1

The **operational** punch-list of concrete, checkable items gating the first public
launch (the M5/M6 work in `roadmap.md`). `roadmap.md` is the strategic plan —
*what* we build and *in what order*. This file is the short-lived task tracker and
the day-to-day guide for development; once v0.0.1 ships, archive or clear it.

Status legend: `[ ]` open · `[x]` done · `[~]` accepted as-is for v1 (no work planned).

> New v1 features below (reorder favorites, downstream stops) should have their
> acceptance criteria backfilled into `product-requirements.md` once built, so that
> doc stays the source of truth on scope. This file tracks the *doing*.

## Open work (v0.0.1) — suggested order

### 1. Raster PWA icons — nice-to-have (older iOS / Android)
- [x] Icon redesigned as a side-view ATL bus. SVG renders correctly on iOS 26
  home-screen install (verified on device), so the manifest's `sizes: 'any'`
  declaration is acceptable on current iOS — the original blocker premise
  (iOS Safari ignoring SVG home-screen icons) no longer applies.
- [x] PNG fallbacks (192, 512, 512-maskable, 180 apple-touch) shipped. SVGs
  still come first in the manifest icons array so modern browsers stay on
  vector; PNGs are the safety net for older iOS / Android that ignore SVG
  icons. `apple-touch-icon` in `index.html` points at the 180 PNG (older iOS
  required raster). Regeneration recipe in `packages/web/public/icons/README.md`
  uses macOS `qlmanage` — no build-time dependency added.
- **Files:** `packages/web/vite.config.ts`, `packages/web/index.html`,
  `packages/web/public/icons/`.

### 2. Cold-open loading state — decided: branded loading shell (loading-only)
- [x] Replace `BundleGate`'s text `MessageCard` with a branded loading view:
  an "Atlanta Transit" header strip + a content-area skeleton. Visible only
  during the cold-open fetch of `stops.json`/`routes.json`; vanishes once the
  bundle resolves and normal page rendering takes over. Shipped as
  `LoadingShell` (commit 03d10b4); the follow-on dogfood revealed a second
  visible wait while the lazy Home chunk downloaded, fixed by preloading the
  route chunk in parallel with the bundle (`preloadInitialRoute.ts`, wired
  from `main.tsx`).
- **Why loading-only, not a persistent app shell.** The original sketch read as
  "lift the shell out of `BundleGate`" — implying a persistent app-level header
  with brand + Settings link on every screen. Dropped after design review:
  (a) Settings is set-once on a transit app (language + clock format), so an
  always-visible Settings link spends precious phone-vertical real estate on a
  feature users rarely re-open; (b) repeating the brand on every screen steals
  rows from content, the opposite of mobile-first; (c) per-page `← back` headers
  are direction-specific (e.g. `RouteDetail` → `/routes`) and don't belong
  inside app chrome. The cold-open problem is real and small — a loading-only
  shell solves it without imposing permanent cost on every other screen.
- **A11y:** the loading view is a polite live region announcing "Loading…"
  (re-use the existing `bundle.loadingTitle` string); skeleton bars are
  `aria-hidden`. Brand text is a `<span>`, not an `<h1>` — per
  `ux-guidelines.md` *"every screen has a single h1"*, and we don't want the
  brand to claim that slot.
- **TDD:** extract a presentational `LoadingShell` (no async, no hook) so the
  branded-view test runs without fetch mocking; `BundleGate` then composes it.
- **Files:** `packages/web/src/App.tsx` (BundleGate swaps `MessageCard` →
  `LoadingShell`), new `packages/web/src/LoadingShell.tsx` + sibling test.

### 3. Theme toggle UI (Auto / Light / Dark) in Settings
- [x] Add the 3-way selector PRD + `ux-guidelines.md` call for. Dark mode already
  renders (the `index.html` bootstrap follows OS preference); this adds the control.
  Shipped as `useThemePreference` (sibling-tested hook, no Context — single
  consumer) + Zod-validated `themeStorage` + pure `resolveEffectiveMode`, with a
  `ThemeSection` rendered first in `Settings.tsx`. Storage key shared verbatim
  with the bootstrap script; `matchMedia` listener subscribed only while in Auto
  so an OS-level toggle propagates without a reload.
- **Subtlety:** the React control must write `atl-transit:theme` and toggle
  `<html class="dark">` in a way the bootstrap script also respects on next load
  (no flash-of-wrong-theme). No reload required to apply.
- **Files:** `packages/web/src/pages/Settings.tsx`, a theme context/hook,
  `packages/web/index.html` (shared key contract).

### 4. Reorder favorites (dogfood finding A)
- [x] **Reorder-only.** No rename/add/delete in this mode; removal stays on the
  stop-detail star. An inline toggle next to the **"My stops"** `<h2>`, labeled
  **"Reorder" → "Done"**, shown only when there are 2+ favorites. In reorder mode,
  cards stop navigating and the right-edge chevron slot swaps to a vertical
  `↑`/`↓` pair (disabled at the ends). No drag-and-drop in v1.
- **No app-level header.** The original sketch said "header toggle." We decided
  against an app chrome header when shipping `LoadingShell` (#2 above), so the
  toggle lives inline with the `My stops` heading, not in an app-wide bar.
- **Smooth in/out of reorder mode.** The card preserves its dimensions across
  the toggle: same height, same width, same arrival preview. Only the right-edge
  slot's content changes (`›` chevron → ↑/↓ pair) and the card stops being a
  `<Link>`. No skeleton reflow, no card-height jump. Reorder mode is local state
  on `Home`; navigating away or dropping below 2 favorites ends it.
- **Logic (TDD, red first):** pure `moveFavorite(list, stopId, 'up'|'down'):
  Favorite[]` in `features/favorites/reorder.ts` — bounds and unknown-id return
  the same array reference (lets React short-circuit); `FavoritesContext.move`
  calls it inside `setFavorites` and persists via the existing `saveFavorites`.
  No new persistence code, no Zod changes (`max(10)` already covers it).
- **A11y (required):** move buttons carry the stop identity in their label
  (`"Move Ponce @ Barnett up"`); a visually-hidden polite live region announces
  the full result (`"Ponce @ Barnett moved to position 2 of 4"`) so screen-reader
  users get the same confirmation sighted users get from the visible move; focus
  stays on the pressed button after the DOM reorders; list stays semantic
  `<ul>/<li>`. No visible toast — the move itself is the confirmation. (No
  formal ARIA "reorder" widget exists; labels + live region carry recognizability,
  the standard DnD-accessible alternative.)
- **New `Icon` glyphs.** Extend the icon atom with `chevron-up`/`chevron-down`
  rather than Unicode arrows — Unicode arrow weight varies across host fonts
  (heavier on Android, lighter on iOS) and would look inconsistent next to
  the existing icon vocabulary (`refresh`, `close`, `star`). The SVG path keeps
  stroke-width and size consistent with the rest of the system.
- **Files:** new `packages/web/src/features/favorites/reorder.ts` + sibling test,
  `packages/web/src/features/favorites/FavoritesContext.tsx`, `FavoriteStopCard.tsx`,
  `packages/web/src/pages/Home.tsx`, `packages/components/src/atoms/Icon.tsx`
  (+ test), `packages/web/src/i18n/en.json` + `es.json`.
  `services/storage.ts` is intentionally unchanged.

### 5. Downstream stops on an arrival (dogfood finding B)
- [x] **Progressive disclosure only.** Default stop view is unchanged; tapping a
  specific arrival row expands *that bus's* downstream stops inline, so a rider can
  confirm it's their branch (a route number can have several headsigns/patterns —
  e.g. 11 → Collier Rd vs → UPS Distribution Ctr — and the headsign alone isn't
  how riders identify their bus). Map view stays out of scope (v2).
- **Two data paths, one shape.** Live trips already carry their downstream stops
  in `TripUpdate.stopTimeUpdates` — stop IDs, predicted ETAs, *and* per-stop
  SKIPPED flags, all free from the realtime feed (recon on the 2026-05-22
  snapshot: median 44 stops/trip, max 94, all forward of the bus's current
  position). Scheduled / no-live-data / cancelled trips fall back to a new
  backend endpoint. Both paths normalize into the same `DownstreamStop[]` shape,
  so the branching lives in one mapper, not in the UI.
- **Backend: `getStopsForTrip(tripId): Promise<TripStop[]>`** where
  `TripStop = { stopId, stopSequence }`. Full ordered pattern, no `fromStopId`
  param — wire payload is ~1 KB and the cache fragments less when the URL
  doesn't vary by rider stop. Edge cache `s-maxage=300` mirrors
  `route-directions`. Client slices to downstream via a pure helper. Rides the
  ADR-0006 seam — no new ADR.
- **Plumb `stopSequence` through `ScheduledStopVisit` → `ClassifiedBusRow`.**
  The backend already has it from the `stop_times` join; carrying it costs one
  field on the wire Zod schema, the type, the classifier, and the in-memory
  path (~30 min total). MARTA doesn't run loop routes today, but threading the
  real sequence number is the semantically honest representation (the row *is*
  a specific occurrence on the trip) and removes a class of subtle bugs that
  "first-occurrence-by-stopId wins" would otherwise smuggle in.
- **SKIPPED downstream stops are marked when known.** GTFS-RT publishes
  `scheduleRelationship: SKIPPED` per stop. For the live path we surface this
  with strikethrough + a "skipped" label (mirrors how a cancelled arrival row
  already renders) so a rider whose target stop is being passed by this trip
  sees it before boarding. The scheduled path has no SKIPPED data — fine; that
  path already carries less info by definition.
- **Component placement (per ADR-0003).** `BusRow` in `@atl-transit/components`
  stays a pure visual atom; the open/close state, `aria-expanded` button, and
  expanded panel live in a new `BusRowDisclosure` wrapper in
  `packages/web/src/features/stops/`. Domain interaction stays out of the
  components library.
- **Prep commit: Map indexes on the repo impls.** Both `InMemoryGtfsRepository`
  and `HybridGtfsRepository` resolve `getStop(id)` / `getRoute(id)` via
  `Array.find()` over ~5k stops today. The disclosure will fire many lookups
  per open; replace with `Map<id, …>` built once in the constructor (a
  `private readonly` field — the bundle is immutable for the lifetime of the
  repo instance, no React memoization needed). One-line `find` → `get` swap
  per method. Independent benefit: also speeds up existing
  `getRouteDirections` enrichment.
- **TDD seams (red first).**
  Pure `downstreamStops(tripStops, currentStopSequence): TripStop[]` in
  `features/stops/downstreamStops.ts` — filters to `stopSequence >
  currentStopSequence`. Sibling test covers: empty when at last stop, missing
  sequence, loop disambiguation. No fetch mocking.
  Pure normalizer `liveTripUpdateToTripStops(update): TripStop[]` so the
  live-path mapper test stays free of realtime fixture wrangling.
- **A11y.** Disclosure trigger is a `<button>` carrying the trip identity in
  its `aria-label` ("Show stops for route 11 to UPS Distribution Ctr at 12:34");
  `aria-expanded` reflects open/closed; the expanded panel is the next sibling
  with `aria-hidden` toggled. SKIPPED stops get an `sr-only` "skipped" annotation
  alongside the strikethrough so the visual and screen-reader signal agree.
  Loading state inside an open panel is a polite live region (re-use
  `loading.*` strings).
- **Per-stop times in the disclosure panel — live path only (shipped).** Each
  downstream stop renders its arrival time *before* the stop name — time-first
  creates a scannable left-aligned `tabular-nums` column, matching the BusRow's
  "time-as-primary" pattern. Format is **clock time only** ("12:34" / "1:30 PM"),
  via `useFormatTime` so the user's 12h/24h Settings preference and Atlanta
  timezone are respected. Times come from
  `TripUpdate.stopTimeUpdates[].arrival.time` (shifts with the bus's actual
  position, so a late bus shows later downstream times automatically). The
  wiring was already in place; this slice flipped the layout to time-first
  and added an em-dash placeholder for `NO_DATA` rows (~12% of MARTA's
  downstream updates per the 2026-05-22 recon — bus still serves the stop,
  agency just lacks a live prediction), `aria-hidden` so screen readers hear
  only the stop name.
- **Deferred (scheduled-path times + rename) — shipped 2026-05-31 in v0.0.2.**
  The scheduled / no-live / cancelled paths originally rendered name-only because
  they had no time data at launch. Resolved post-launch (same day) with the
  backend wire change (`TripStopWire.scheduledTime`,
  `queryStopsForTrip(tripId, date)` selecting `arrival_time` + `gtfsTimeToUnixSec`),
  the field rename (`predictedArrivalText` → `arrivalText`), and the client
  `predictedArrivalTime ?? scheduledTime` fallback. See `roadmap.md` post-launch
  polish backlog entry for the full as-shipped notes.
- **Follow-up — match BusRow severity colors on live downstream times.**
  The BusRow itself uses status color to telegraph timing (green for
  early/on-time, yellow for slight delay, red/cancelled for late or
  cancelled). The disclosure currently renders all per-stop times in
  `text-fg-muted` regardless of how the prediction compares to schedule.
  We should investigate carrying that same severity down to each downstream
  stop's time: compute per-stop `delaySec = predictedArrivalTime -
  scheduledTime`, classify via the same thresholds the row classifier uses,
  and color the time accordingly. Requires the live path to *also* have the
  scheduled time per stop (currently scheduled lives on the scheduled-path
  fetch only) — either fold scheduled into the live mapper, or have the
  disclosure merge both when both are available. Not blocking v0.0.1 launch;
  capture as a v1.1 polish item.
- **Files:** `packages/web/api/gtfs/queries.ts` + new `trip-stops.ts` handler,
  `packages/web/vercel.json` (new function entry),
  `packages/web/src/services/gtfs/GtfsRepository.ts` +
  `InMemoryGtfsRepository.ts` + `HybridGtfsRepository.ts`,
  `packages/web/src/services/gtfsStatic.ts` (stopSequence in the InMemory path),
  `packages/web/src/features/stops/busRowClassifier.ts` (stopSequence on visit + row),
  new `packages/web/src/features/stops/downstreamStops.ts` + sibling test,
  new `packages/web/src/features/stops/BusRowDisclosure.tsx` + sibling test,
  `packages/web/src/pages/StopDetail.tsx`,
  `packages/web/src/i18n/en.json` + `es.json`.

### 6. Scroll-to-top on forward navigation (dogfood finding C)
- [x] **Reset `window.scrollTo(0, 0)` on every pathname change.** Without it, a
  user who scrolled down on Home to reach the "Browse all routes" or Settings
  link lands part-way down the next page — the document doesn't unmount between
  SPA routes, so the previous scroll position carries over. Expected web UX is
  that forward navigation lands at the top. Shipped as `ScrollToTop` rendered
  inside `App`, using `useLayoutEffect` (not `useEffect`) so the scroll happens
  between commit and paint — `useEffect` lets the new page paint for one frame
  at the old scroll position, which is perceptible. Deps on pathname only, so
  search/hash changes (e.g. `?lng=es`) don't yank the scroll.
- **Scope: forward-only, not full restoration.** Pages in this app are 1–2
  screens; landing-at-top on browser back costs one swipe to recover prior
  scroll, and the simpler "every nav starts at the top" contract is easier to
  predict than per-key scroll-position persistence. Promote to full
  `ScrollRestoration` only if back-button dogfooding shows it's actually
  annoying.
- **Implementation:** a tiny `ScrollToTop` component using `useLocation` +
  `useEffect`, rendered inside `App` (under the existing `BrowserRouter`).
  ~10 lines.
- **Files:** `packages/web/src/App.tsx`.

## Accepted as-is for v1 (revisit post-launch)

- [~] **Cold-open performance / bundle budget.** Dogfooded; happy for v1. The eager
  realtime/protobuf import (~85 KiB in the entry chunk) and the formal 2s / <200 KB
  measurement are post-launch optimization candidates in `roadmap.md`.
- [~] **Spanish translation quality.** en/es key parity is machine-enforced
  (`i18n/translations.test.ts`); wording is acceptable for v1.

## Needs device verification (process, not code)

- [x] Dogfood commutes — several done; ongoing.
- [x] Re-verify iOS **and** Android PWA install after the raster-icon fix.
  Chromium Android confirms the app as installable; "all Android browsers"
  isn't practically testable, so accepting this for v1.
- [x] Dark-mode contrast spot-checked on every screen in both themes.

## Confirmed done (verified in code during the M5/M6 audit)

Route-level error boundaries with reset-on-navigate · theme bootstrap (no FOWT) ·
route code-splitting · service worker precache + realtime `NetworkFirst`/5s +
`/api/gtfs` caching · i18n en/es parity enforced by test · empty states · skeleton
component (StopDetail/RouteDetail/FavoriteStopCard) · README license + attribution +
"not affiliated" disclaimer · Settings attribution/disclaimer/version · install
prompt (Android + iOS instructions) · realtime proxy · SQLite backend · nightly cron.
</content>
