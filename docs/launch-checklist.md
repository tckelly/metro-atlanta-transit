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
- [ ] PNG fallbacks (192, 512, 512-maskable, 180 apple-touch) for older iOS /
  Android compatibility. Not blocking launch; safe to defer post-v1.
- **Do (if pursued):** generate PNGs from `icon.svg`, wire into the manifest +
  `<link rel="apple-touch-icon">`.
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
- [ ] Add the 3-way selector PRD + `ux-guidelines.md` call for. Dark mode already
  renders (the `index.html` bootstrap follows OS preference); this adds the control.
- **Subtlety:** the React control must write `atl-transit:theme` and toggle
  `<html class="dark">` in a way the bootstrap script also respects on next load
  (no flash-of-wrong-theme). No reload required to apply.
- **Files:** `packages/web/src/pages/Settings.tsx`, a theme context/hook,
  `packages/web/index.html` (shared key contract).

### 4. Reorder favorites (dogfood finding A)
- [ ] **Reorder-only.** No rename/add/delete in this mode; removal stays on the
  stop-detail star. A header toggle labeled **"Reorder favorites" → "Done"**,
  shown only when there are 2+ favorites. In reorder mode, cards stop navigating
  and show `↑`/`↓` move buttons (disabled at the ends). No drag-and-drop in v1.
- **Logic (TDD, red first):** pure `moveFavorite(list, stopId, 'up'|'down')` —
  bounds and unknown-id are no-ops; `FavoritesContext` action persists the
  reordered array (storage Zod `max(10)` unchanged).
- **A11y (required):** move buttons carry the stop identity in their label
  (`"Move Ponce @ Barnett up"`); a polite live region announces the result
  (`"position 2 of 4"`); focus stays on the pressed button after the DOM reorders;
  list is semantic `<ul>/<li>`. (No formal ARIA "reorder" widget exists — labels +
  result announcement carry recognizability; this is the standard DnD-accessible
  alternative.)
- **Files:** `packages/web/src/features/favorites/FavoritesContext.tsx`,
  `FavoriteStopCard.tsx`, `packages/web/src/pages/Home.tsx`,
  `packages/web/src/services/storage.ts`.

### 5. Downstream stops on an arrival (dogfood finding B)
- [ ] **Progressive disclosure only.** Default stop view is unchanged; tapping a
  specific arrival row expands *that bus's* downstream stops inline, so a rider can
  confirm it's their branch (a route number can have several headsigns/patterns —
  e.g. 11 → Collier Rd vs → UPS Distribution Ctr — and the headsign alone isn't
  how riders identify their bus). Map view stays out of scope (v2).
- **Data:** the query already exists in spirit — `queryRouteDirections` does
  `SELECT stop_id FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence`. Add a
  `getStopsForTrip` (optionally `(tripId, fromStopId)` to return downstream only);
  wire payload is stop IDs, names resolved client-side from the in-memory bundle.
  Rides the ADR-0006 seam — no new ADR. (~2 days w/ tests.)
- **Files:** `packages/web/api/gtfs/queries.ts` + a handler/endpoint,
  `packages/web/src/services/gtfs/GtfsRepository.ts` + `InMemory`/`Hybrid` impls,
  `packages/web/src/pages/StopDetail.tsx` + a disclosure component.

## Accepted as-is for v1 (revisit post-launch)

- [~] **Cold-open performance / bundle budget.** Dogfooded; happy for v1. The eager
  realtime/protobuf import (~85 KiB in the entry chunk) and the formal 2s / <200 KB
  measurement are post-launch optimization candidates in `roadmap.md`.
- [~] **Spanish translation quality.** en/es key parity is machine-enforced
  (`i18n/translations.test.ts`); wording is acceptable for v1.

## Needs device verification (process, not code)

- [x] Dogfood commutes — several done; ongoing.
- [ ] Re-verify iOS **and** Android PWA install after the raster-icon fix.
- [ ] Dark-mode contrast spot-checked on every screen in both themes.

## Confirmed done (verified in code during the M5/M6 audit)

Route-level error boundaries with reset-on-navigate · theme bootstrap (no FOWT) ·
route code-splitting · service worker precache + realtime `NetworkFirst`/5s +
`/api/gtfs` caching · i18n en/es parity enforced by test · empty states · skeleton
component (StopDetail/RouteDetail/FavoriteStopCard) · README license + attribution +
"not affiliated" disclaimer · Settings attribution/disclaimer/version · install
prompt (Android + iOS instructions) · realtime proxy · SQLite backend · nightly cron.
</content>
