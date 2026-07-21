# Real-time rail

Add real-time MARTA heavy rail data so the app covers riders whose commute involves at least one rail leg. v0.0.1 is bus-only by design (see `vision.md` non-goals) — rail was originally Tier 3 / speculative in `roadmap.md` because the spec questioned scope-vs-Terminus and the API shape was unknown. This doc reopens that question for v0.0.x and tracks what we learn as we get hands-on with the API.

This doc is a living design conversation — edit the sections below as decisions land. Load-bearing decisions spawn ADRs (linked inline from the relevant section).

**Status: v0.0.2 — station-detail page built end-to-end (build steps 1–6 complete); entry point + `stopId` registry deferred.** The key is registered, Phase-2 recon is done (real payload snapshotted — see Recon log), and two ADRs are recorded: [ADR-0010](../adr/ADR-0010-secret-injecting-rail-proxy.md) (secret-injecting proxy) and [ADR-0011](../adr/ADR-0011-accept-marta-authoritative-rail-times.md) (accept MARTA's authoritative times/delay). **Built:** the proxy, the client service (`martaRail`), the shared ETA/delay formatters (`utils/arrivalFormat`), `ArrivalRow` (renamed from `BusRow`) + `LineIndicator`, `railRowMapper`, `groupArrivalsByLineDestination`, `useRailArrivals`, and the `StationDetail` page on the lazy `/station/:stationName` route — keyed on the feed name, so all 38 stations work today. See [UI architecture — reuse audit & build plan](#ui-architecture--reuse-audit--build-plan-decided-2026-07-20) below. **Deferred follow-ups:** a **feed-derived station directory** now ships at `/stations` (linked from Home), so rail is reachable in-app — deeper entry points (Nearby integration, favorites) still want the registry; the nightly-regenerated, drift-validated `stopId` registry for canonical names + Nearby/search/favorites parity (see the recon); and **live dogfooding against real rail data, which needs the API key** (unit/integration tests pass, and the proxy was prod-verified, but the page hasn't been driven end-to-end with a live feed locally). Final UX calls still wait on that dogfooding.

### Getting the key

Register at **`https://www.itsmarta.com/developer-reg-rtt.aspx`** (MARTA's Real-Time Train / RTT developer registration). The form asks for name, company, mailing address, phone, and email, and requires accepting the EULA. It's **free** ("There shall be no cost for the access"), asks for no intended-use description, and states no rate limits or approval timeline — the key is presumably emailed. Standard public-agency EULA caveats: no accuracy/completeness warranty, MARTA can change or cut the feed at any time without notice, and the user indemnifies MARTA for claims arising from data use. **The key is a query-param secret — it goes in `.env.local` (gitignored) and is injected server-side, never shipped to the client.** See Architecture.

## Problem

Atlanta's heavy rail is 4 lines — **Red** and **Gold** (north–south) and **Blue** and **Green** (east–west) — all converging at Five Points downtown. A meaningful slice of commuters use rail as one leg of a multi-modal trip: bus to a station, train downtown, or park-and-ride at an end-of-line station. For those riders, a bus-only app answers half their question.

Frame against `personas-and-jobs.md`: the existing persona's jobs ("is my bus coming?", "is my route disrupted?", "what's near me?") translate almost directly to rail ("is my train coming?", etc.) — the *job* is the same, the *mode* differs. That's the argument for a unified surface rather than a separate persona: a rail rider isn't a different kind of person, they're the same commuter on a different vehicle. **Open:** whether rail-specific behaviors (frequency-based service where you don't consult a schedule, transfers at Five Points) justify distinct UX treatment. Deferred to UX below.

Relationship to the "scope vs Terminus" question (a competing Atlanta transit app): rail is table-stakes for a general transit app, so shipping it isn't differentiation by itself — our differentiation stays the *bus* UX (see North Stars). Rail earns its place by making the app viable for multi-modal commuters who'd otherwise keep a second app open, not by out-railing Terminus. Keep rail scope tight: real-time arrivals at a station, matching the bus stop-detail pattern. Resist gold-plating (full rail trip planning is a non-goal, same as bus).

## Data

**Reconned 2026-07-13 from MARTA's public developer resources page** (`itsmarta.com/app-developer-resources.aspx`) — *documented shape, not yet verified against a live payload.* Phase-2 recon (a real snapshot) confirms/corrects everything below.

**Endpoint:**
```
https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/developerservices/traindata?apiKey=xxxx-xxxx-xxxx-xxxx
```

- **Format:** JSON (not protobuf — unlike the bus GTFS-RT feeds, so `@atl-transit/gtfs`'s decoders don't apply; rail gets its own Zod schema).
- **Auth:** API key as a **query parameter**. This is the load-bearing constraint — see Architecture.
- **Coverage:** all MARTA train stations, all 4 lines, in a single response (system-wide, like the bus feeds).

**Documented response fields** (one object per predicted train arrival at a station):

| Field | Meaning | Notes / how we'd use it |
|---|---|---|
| `STATION` | Station name | Joins to station identity; grouping key for a station-detail view |
| `LINE` | `RED` \| `GOLD` \| `BLUE` \| `GREEN` | Maps to a line color (semantic token, not raw hex) |
| `DIRECTION` | Cardinal (`N`/`S`/`E`/`W`) | Disambiguates platform/track — parallels the bus direction disambiguator (ADR-0008) |
| `DESTINATION` | Terminus headsign | Human-readable "where this train is going" |
| `TRAIN_ID` | Train identifier | Stable key for a specific train across polls |
| `NEXT_ARR` | Next arrival (clock time) | Prefer `WAITING_SECONDS` for our own ETA formatting, for consistency with bus |
| `WAITING_TIME` | Human-readable countdown | MARTA's own formatting; we likely re-derive from seconds |
| `WAITING_SECONDS` | Seconds until arrival | Canonical ETA input — same role as bus predicted-arrival delta |
| `IS_REALTIME` | Real-time vs scheduled *(inferred)* | Likely maps onto our `live` / `no_live_data` status classification |
| `DELAY` | Delay indicator *(semantics unconfirmed)* | Candidate input to severity coloring, *if* it's a signed number or clear enum |
| `LATITUDE` / `LONGITUDE` | Train position | Enables a map view — more compelling for rail than bus (see UX) |
| `EVENT_TIME` | Data timestamp | Feed freshness / "last updated" |

*Inference flags — resolved in Phase-2:* every field is actually a **string** (the types above were Phase-1 guesses); `IS_REALTIME` is `"true"`/`"false"` (→ live/scheduled status) and `DELAY` is a signed `T<seconds>S` duration (→ viable severity input). `DELAY`/`LATITUDE`/`LONGITUDE` appear only on real-time records. See the Recon log for the confirmed shape.

**Mapping onto existing patterns.** The response is arrival-prediction-shaped *per station*, which is structurally the same as our bus stop-detail ("next buses at this stop"). So `IS_REALTIME` → status classification, `WAITING_SECONDS` → ETA formatting, `DIRECTION` → the disambiguator pattern (ADR-0008), and `LINE` → a color token all reuse machinery we already have. This is the strongest argument that rail is an *extension* of the current app, not a parallel one.

### Client DTO (`services/martaRail.ts`) — field decisions

The client re-validates the proxy's JSON (defense-in-depth per CLAUDE.md — the proxy output is still "external data" to the browser) and normalizes it into a trimmed, camelCased DTO. This is deliberately a *narrower, parsed* shape than the proxy's broad drift-guard schema (`railArrivalSchema`) — the two are intentionally different (ADR-0010 "Revisit when": narrow the client to what the UI consumes). Adding or dropping a field here is a one-line, reversible change with no migration, so these are tracked here rather than in an ADR (the *timing-source* decision behind them is [ADR-0011](../adr/ADR-0011-accept-marta-authoritative-rail-times.md)).

**Proposed DTO shape:**

```ts
export interface RailArrivalDTO {
  station: string;        // STATION
  line: string;           // LINE — kept a string; → color token at the web boundary (ADR-0003)
  direction: string;      // DIRECTION (N/S/E/W)
  destination: string;    // DESTINATION headsign
  trainId: string;        // TRAIN_ID — stable key across polls
  arrivalTime: number;    // derived: parse(EVENT_TIME) + WAITING_SECONDS — see ADR-0011
  isRealtime: boolean;    // IS_REALTIME "true"/"false" → live vs scheduled status
  delaySeconds?: number;  // DELAY "T<sec>S" → signed; realtime-only
  latitude?: number;      // realtime-only; kept for a future map view
  longitude?: number;     // realtime-only
}
```

**Keep / drop, with rationale:**

| Feed field | DTO | Why |
|---|---|---|
| `STATION`, `LINE`, `DIRECTION`, `DESTINATION`, `TRAIN_ID` | keep (as strings) | Core identity/grouping. `LINE` stays a string; the `LINE → token` map lives at the web boundary (ADR-0003) so an unknown line degrades one row. |
| `WAITING_SECONDS` + `EVENT_TIME` | folded → `arrivalTime` (number) | Re-anchored to an absolute unix timestamp so the countdown stays fresh through the edge cache / between polls and reuses `formatEta` — see [ADR-0011](../adr/ADR-0011-accept-marta-authoritative-rail-times.md). Raw `waitingSeconds` is **not** carried separately (derivable; YAGNI). |
| `IS_REALTIME` | keep → `isRealtime` (boolean) | Parsed `"true"`/`"false"` → the live vs scheduled status classification. |
| `DELAY` | keep → `delaySeconds?` (signed int) | MARTA's authoritative schedule deviation, parsed `T<sec>S`. Optional (real-time-only). Consumed by delay-label/severity later; parsing now is trivial and it's the obvious next consumer. |
| `LATITUDE` / `LONGITUDE` | keep → `latitude?` / `longitude?` (number) | Real-time-only. No consumer in the first cut (map view is out of scope), but retained pending a milestone-time YAGNI pass rather than dropped now. |
| `NEXT_ARR` | drop | We re-derive ETA from the anchored `arrivalTime` for consistency with bus; MARTA's pre-formatted clock string isn't consumed. |
| `WAITING_TIME` | drop | MARTA's human countdown ("1 min" / "Arriving"); we format our own via `formatEta` for a single presentation path across modes. |

**YAGNI note.** `latitude`/`longitude` are retained deliberately despite having no first-cut consumer — we'll do a keep-vs-drop sweep of unused fields at a release milestone rather than churn the DTO now.

### Architecture — a secret-injecting proxy ([ADR-0010](../adr/ADR-0010-secret-injecting-rail-proxy.md))

The query-param key **cannot live in the client** — anything in the bundle or a client request is publicly visible, which would leak the key. So rail requires a server-side proxy that holds the key (env var / `.env.local`, gitignored per CLAUDE.md security) and appends it to the upstream call. CORS and the non-standard port (`:18096`) almost certainly block a direct browser fetch too, exactly as they did for the bus feeds (ADR-0005) — but the key-exposure reason alone is decisive.

We already run a minimal backend proxy for the bus feeds (**ADR-0005**), which partially superseded the original "no backend" decision (**ADR-0001**). But ADR-0005 was deliberately scoped to **public, no-auth, hard-coded** upstream URLs with **no secrets and no user input** — its whole risk argument ("open relay for two specific upstream URLs") rests on there being nothing to protect. A rail proxy that injects a secret key is a *different* security posture: it must never echo the key, and a naive passthrough that forwards client query params could leak or let callers override it. That's a load-bearing change to the proxy's threat model, so **rail warrants its own ADR — see [ADR-0010](../adr/ADR-0010-secret-injecting-rail-proxy.md) (Proposed)** — rather than quietly extending ADR-0005. The rail endpoint returns JSON, so — unlike the byte-passthrough bus proxy — the function *can* cheaply decode/validate/trim server-side (Zod), and could filter to a requested station to shrink the payload, mirroring the "server-side trip-update filtering" candidate in `roadmap.md`.

**Implemented (2026-07-13).** The Edge Function reads the key from `process.env` and appends it to a fixed base URL (never from the client request, so a caller can't override or read it); the key never appears in the response body, headers, or error messages. Validation is **per-record**: the proxy drops individual malformed records and serves the rest, so one bad record can't blank the whole ~500-record feed (graceful degradation). `LINE` is kept a plain string, not an enum — the value maps to a color token at the web boundary (ADR-0003), so an unexpected line degrades one row rather than the feed. Unknown keys are stripped. **Schema-paring direction:** the full validated shape earns its keep now as a drift guard, but once the client's field needs are known we'll narrow the *required* set to the fields the UI actually consumes — since records that fail validation are dropped, requiring an unused field would let a drift in that field silently drop records. The trimmed/normalized client DTO (parsed numbers, booleans, camelCase) lands with the client service.

## UX

Informed by the recon; final calls wait on the live data and dogfooding.

**Leaning: unified surface, not a separate sub-app.** Because the rail arrival shape maps onto the bus stop-detail pattern, a **station-detail view** that mirrors stop-detail is the natural home — "next trains at Five Points" reads like "next buses at this stop." Candidate integration points:

- **Station detail** ≈ stop detail: grouped by `LINE` + `DESTINATION` (see the Grouping note in the UI architecture section), each row an upcoming train with ETA from `WAITING_SECONDS` and a live/scheduled badge from `IS_REALTIME`.
- **Favorites** — do rail stations share the favorites store with bus stops, or live separately? *Open question below.* Unified is friendlier for multi-modal commuters; separate is simpler to model.
- **Nearby** — stations could appear in the nearby list alongside stops (they have lat/lng in static GTFS), with a mode indicator. Only if it doesn't muddy the glanceable bus-first experience.

**Rail-specific UX tensions:**
- **Frequency vs schedule.** Rail riders often don't consult a schedule — they show up and wait. "Next train: 4 min" is the whole answer; a scheduled timetable matters less than for bus.
- **Line color → a `LineIndicator` atom (decided 2026-07-13).** Rail leans hard on line color (Red/Gold/Blue/Green) as identity. A small color swatch rendered from a semantic `line` token (CLAUDE.md brand rule — not raw Tailwind palette), **always paired with the line-name text so color is redundant reinforcement, never the sole signal** — critical because rail has both a Red *and* a Green line (the classic color-vision-deficiency confusion pair). CSS token swatch, **not emoji** (there's no gold emoji — 🟡 reads as yellow; emoji render inconsistently across platforms and are noisy for screen readers). The swatch is `aria-hidden` (the adjacent i18n label already names the line). Lives in `@atl-transit/components` taking a **visual-semantic** prop (a `line` token), not a domain `LINE` value (ADR-0003); the web boundary maps `LINE: "RED"` → token, with a neutral fallback for an unknown line value (the payoff of keeping `LINE` lenient). **Built 2026-07-20:** `line-{red,gold,blue,green}` brand tokens added to the design-system source of truth (`tokens/colors.ts`, which the Tailwind preset auto-derives), the prop is `line: 'red' | 'gold' | 'blue' | 'green' | 'neutral'`, and the atom renders swatch + required label together so the a11y pairing is enforced in one place. `neutral` reuses `fg-muted` (no new token) for the unknown-line fallback.
- **Map view.** `LATITUDE`/`LONGITUDE` per train makes a map genuinely useful for rail (watching your train approach Five Points), where the roadmap has held the line on bus maps for bundle-weight reasons. Rail may be where a map first earns its keep — but that's a v2-scale decision, out of scope for the first rail cut.

## UI architecture — reuse audit & build plan (decided 2026-07-20)

The station-detail UI is built as an *extension of the bus stack*, not a parallel one. A reuse audit of the bus surfaces (organism → mapper → hook → provider → page) settled what we reuse, what existing bus code we change, and what's new.

**Grouping symmetry.** Rail groups by `LINE` + `DIRECTION` exactly as bus groups by route + headsign. The `LineIndicator` lives in the **group header** (mirroring the bus `RouteSection` header's route + headsign `DirectionLabel`), so each rail arrival *row* is just ETA + secondary + severity — the existing visual-semantic row props. No per-row line slot is needed, which is why the row component reuses cleanly.

**Reuse as-is:** the arrival-row organism (see rename below), `LineIndicator`, `DirectionLabel`, `MessageCard` / `Skeleton` / `Button` / `Icon`, `freshnessTier`, `formatLastUpdated`, `useNowSec`, `serviceDate`.

**Changes to existing bus code:**
- **Promote `formatEta` / `formatDelay` (+ the severity thresholds) out of `busRowMapper.ts` into a shared `utils/` module.** The rail mapper is the second consumer (CLAUDE.md "promote on the second consumer"); bus imports them back. Pure functions with existing test coverage → low-risk.
- **Rename `BusRow` → `ArrivalRow`.** Its props are already visual-semantic (ADR-0003), so the rename is mechanical (touches `BusRowProps`, `busRowMapper`, `BusRowDisclosure`, `StopDetail`, and their tests). An honest name once two modes render through it.

**Build new:** `railRowMapper` (`RailArrivalDTO → ArrivalRowProps`; simpler status model — live vs scheduled, no cancellation and no downstream stops), `groupArrivalsByLineDestination` (mirrors `groupRowsByRoute` — see Grouping below), `useRailArrivals` (page-scoped polling hook, same `UseArrivalsResult` contract as `useArrivals`), and the `StationDetail` page + route + i18n keys.

**No change needed:** the static-GTFS pipeline (the rail feed is self-sufficient for arrivals in the first cut, so rail doesn't perturb the bus data pipeline), and the bus `RealtimeFeedProvider` (see polling decision).

### Grouping — line + destination (short-turn-safe)

`groupArrivalsByLineDestination(arrivals): RailLineGroup[]` mirrors the bus `groupRowsByRoute`, keyed on **(line, destination)** — line ↔ route, destination ↔ the bus headsign. Groups follow first-appearance order and preserve input order within a group, *assuming the caller pre-sorted by `arrivalTime`* — the sort lands in `useRailArrivals`, keeping this function single-purpose (the same contract `groupRowsByRoute` has with the classifier's sort). Each group carries `{ line, direction, destination, arrivals }`.

**Why destination, not the explicit `direction`:** MARTA short-turns some trains (e.g. a northbound Red to *Lindbergh Center* vs. to *North Springs* — same line, same `direction: "N"`). Keying on direction would merge them into one section, and a rider heading past Lindbergh must not board the short-turn. Destination is the rail headsign equivalent: it subsumes direction *and* separates short-turns, exactly as bus groups by headsign rather than a coarse direction. `direction` rides along as group metadata for the header/a11y. Two lines that share a destination (Red and Gold both terminate at Airport southbound) stay separate because `line` is in the key.

### `railRowMapper` — status → visual mapping

`toRailRowProps(dto, nowSec, formatters): ArrivalRowProps` maps a `RailArrivalDTO` to the shared `ArrivalRow` visual props, reusing the promoted `formatEta` / `formatDelay` and the shared `DELAYED_THRESHOLD_SEC`. Rail's status model is simpler than bus — two states, no cancellation, no occupancy, no downstream:

| DTO state | primaryText | severity | icon | secondaryText |
|---|---|---|---|---|
| **live** (`isRealtime`), on-time / early | `formatEta(arrivalTime)` → "Arriving" / "N min" / clock | `success` | `clock` | delay label if ≥ 1 min (`formatDelay`), else none |
| **live**, > `DELAYED_THRESHOLD_SEC` (3 min) late | `formatEta(arrivalTime)` | `warning` | `clock` | `formatDelay` → "N min late" |
| **scheduled** (`!isRealtime`) | `formatEta(arrivalTime)` | `neutral` | `clock` | `t('rail.scheduled')` → "Scheduled" |

Decisions:
- **No `danger` / strikethrough and no `warning` *icon*** — the rail feed has no cancellation (Recon log). The only non-`success` live severity is `warning` (a delayed train), and the icon is always `clock`.
- **Scheduled rows still show the countdown**, differentiated by `neutral` severity + a "Scheduled" label — not a clock-only time. This mirrors bus `no_live_data`'s *neutral* treatment while honoring rail's frequency-based UX ("next train: 4 min is the whole answer"); rail's scheduled records carry a genuine timetable ETA, unlike bus `no_live_data` (no prediction at all, hence bus shows a clock time there).
- **`delaySeconds` + severity reuse the shared `DELAYED_THRESHOLD_SEC`**, so a "late" train reads identically across bus and rail.
- **Destination and line/direction are *not* mapper concerns** — they're identity, handled by the line+direction grouping (step 4). The mapper produces only timing/status visual props. Adds one i18n key, `rail.scheduled` (en/es).

### Polling — page-scoped hook now, shared engine later

Rail's first cut has a **single consumer** (`StationDetail`), so it gets a page-scoped `useRailArrivals` hook (polls while mounted, visibility-aware, aborts on unmount) rather than an app-wide provider. The bus `RealtimeFeedProvider`'s subscriber-count machinery exists to *multiplex many simultaneous consumers* (Home's favorite cards) onto one shared fetch — rail has no such multiplier yet (favorites deferred). Generalizing the provider now would mean designing the abstraction against **one real consumer plus one *imagined* one** whose requirements (the favorites model) are still open — the classic wrong-abstraction risk, and against CLAUDE.md's "promote on the second *real* consumer" rule.

This is low-regret because the hook and a future shared provider expose the **same `UseArrivalsResult` contract**: `StationDetail` is written against the contract, not the mechanism, so swapping in a shared polling engine later is a data-layer change that never touches the page. The bus provider's existing test seam (`RealtimeFeedContext` exported so tests inject a frozen snapshot) carries over to that extraction.

- **Trigger to extract a shared engine:** rail gains a second, multi-consumer surface — favorite stations as live cards on Home, or live rail in Nearby — so two *concrete* consumers shape the abstraction correctly.
- **Accepted cost until then:** modest duplicated polling mechanics (visibility-pause / abort / stale-on-error) live in `useRailArrivals`. A deliberate, bounded YAGNI trade, not hidden debt. A tiny generic `useLazyPoll(fetchFn, intervalMs)` primitive is the likely middle-ground extraction point if we want some of that DRY sooner.

### `StationDetail` page — design (proposed 2026-07-20)

Composes the pieces above: `useRailArrivals(stationName)` → `groupArrivalsByLineDestination` → one section per `RailLineGroup`. Reuses the bus stop-detail *shell* (loading skeleton, error card, empty state, last-updated/freshness, back header) **minus** the disclosure (rail has no downstream stops) and — for the first cut — favorites.

**Presentational / container split (the test seam).** Per the dumb/smart rule:
- **`StationDetailView`** (presentational) takes `{ status, groups, lastUpdated, isStale, error, onRefresh, nowSec }` and renders. Tested with RTL against fabricated `RailLineGroup[]` — no hook, no fetch — asserting what a screen reader perceives (section headers, row text, the four states).
- **`StationDetail`** (container) reads the route param, calls `useRailArrivals`, groups, and passes props down. Thin glue, covered by the hook's own tests + the View's tests.

This gives a clean TDD target (the View) *without* injecting a fetcher prop into the page — the page keeps `useRailArrivals`'s default service.

**Section header.** Per group: `LineIndicator(line)` + `line → destination` via the `DirectionLabel` `X → Y` pattern (consistent with bus route→headsign). `direction` (N/S/E/W) is available for a11y. Rows: `toRailRowProps(dto) → ArrivalRow`.

**Routing & station identity — DECIDED: feed name now, `stopId` registry deferred.** Route `/station/:stationName`, param = the feed's canonical `STATION` string (URL-encoded), passed straight to `useRailArrivals`'s exact-match filter; the header title-cases it for display ("FIVE POINTS STATION" → "Five Points Station" — nicer than GTFS's own "Five Points Stn"). This keys the page on the RTT feed itself, so it works for **all 38 stations** regardless of the static-GTFS name drift documented in the recon below. The bus-consistent end-state — routing rail on a stable `stopId` like `/stop/:stopId`, integrated into the same stop registry for Nearby/search/favorites parity — is the right target but a **follow-up** (gated on the registry work below), and a **non-breaking** upgrade from the name-based route.

**Entry point — proposed DEFERRED (out of step-6 scope).** How a user *reaches* a station page (Home rail section, a station list, or Nearby) needs a station list, which needs the station-identity decision. Step 6 delivers the page + route, reachable by URL and dogfoodable directly; the entry point is a follow-up. Likely minimal option: derive the distinct station list from the live feed (system-wide) rather than static GTFS.

**i18n.** New `rail.stationDetail.*` keys (back, loading, error title/body, empty title/body, last-updated), mirroring `stopDetail.*`.

### Station identity — static-GTFS recon (2026-07-20)

Verified against `stops.json` + the committed feed snapshot with a cross-check script (not assumption):

- **Rail is in MARTA's static GTFS.** Routes `RED`/`GOLD`/`BLUE`/`GREEN` (routeIds 26984–26987, with official hex colors — now reconciled into the `LineIndicator` `line-*` tokens (light = exact MARTA hex, dark = lightened)) and all **38 stations** are present in `stops.json` with `stopId`s and coordinates.
- **Parent-station model.** Each station is one *parent* record (empty `routeIds`/`directions`, canonical uppercase name, coords — e.g. Five Points = `stopId 510015`) plus several *platform* records that carry the rail routes. So a station name maps to **multiple `stopId`s**; the parent is the natural canonical id.
- **`stops.json` drops `location_type`/`parent_station`** (the pipeline strips them), so "parent" is currently only inferable via the empty-`routeIds` heuristic. A robust registry should extend the preprocessing to preserve them.
- **Exact-name join is 32/38, not 100%.** Six feed names don't exact-match a static parent, from name drift between MARTA's RTT feed and its GTFS: `LINDBERGH` vs `LINDBERGH CENTER`; `BROOKHAVEN` (only bus-bay records); and `OMNI DOME`, `EDGEWOOD CANDLER PARK`, `INMAN PARK`, `LAKEWOOD` (feed uses shorter/older names). A `name → stopId` registry therefore needs normalized matching + a small alias map, not a naive exact join.

**Registry design (follow-up, with the entry point).** Build a rail-station registry as a **nightly-regenerated artifact** in `preprocess-gtfs` (like `stops.json`), keyed off the feed's authoritative 38-station list and enriched from `stops.json` (parent `stopId`, coords) via normalized match + the alias map. Make the cross-check above a **build-time validation** that fails on new drift, so a MARTA rename can't silently break resolution. This unblocks routing rail by `stopId` and rail parity in Nearby/search/favorites — and is why the page's feed-name identity is a clean, non-breaking stepping stone.

### Station directory — the entry point (built 2026-07-20)

`RailStations` (`/stations`, linked from Home) is the minimal entry point that makes the station-detail page reachable in-app. It's **feed-derived**: `useRailStations` fetches the feed once (no polling — the station set is static) and the pure `railStationsFromArrivals` reduces it to the distinct stations + the lines serving each, keyed on the **feed name** so every `/station/:name` link resolves for all 38 (sidestepping the static-GTFS name drift). Presentational `RailStationsView` reuses the shared `ListItem` row idiom + `LineIndicator` — via the promoted `railLine` (LINE → token/label) and `stationName` (title-case) utils now shared with the station-detail page. The offline-capable, coords-carrying registry (for Nearby/favorites parity) remains the deferred follow-up.

**Build sequence (each a TDD unit):** (1) promote `formatEta` / `formatDelay`; (2) rename `BusRow` → `ArrivalRow`; (3) `railRowMapper`; (4) `groupArrivalsByLineDestination`; (5) `useRailArrivals`; (6) `StationDetail` page + route + i18n.

## Recon log

- **2026-07-13** — Phase-1 recon from MARTA's public developer docs: endpoint, query-param auth, JSON format, and the field list above. No live call (no key yet). Registration page and process documented (Getting the key).
- **2026-07-13 — Phase-2 recon done.** Fetched the live endpoint via the local dev proxy and snapshotted the verbatim response into [`sample-data/marta-rail-2026-07-13/`](../../sample-data/marta-rail-2026-07-13/README.md) (492 records, system-wide). Curated findings in that README. Headlines that correct/confirm Phase-1:
  - **Every field is a JSON string** (numbers, booleans, coordinates all stringified) — the doc-table types were guesses; parse at the boundary.
  - **`DELAY` / `LATITUDE` / `LONGITUDE` appear iff `IS_REALTIME === "true"`** (missing on all 214 scheduled records, present on all 278 live ones) → schema-optional, and **a map view is inherently real-time-only**.
  - **`DELAY` is a signed duration `T<seconds>S`** (`T45S`, `T-7S`, `T0S`) — parseable, so it *is* a viable severity input (the Phase-1 "unconfirmed" flag is resolved), though wiring to color stays a later UX call.
  - **`LINE` is exactly `RED`/`GOLD`/`BLUE`/`GREEN`**; `WAITING_TIME` uses `"Arriving"` as its low-end sentinel; `EVENT_TIME`/`NEXT_ARR` are US-format, not ISO.
  - **No occupancy, no downstream-stops** — confirms the arrival-at-station-centric shape.
- **2026-07-13 — Prod runtime verified.** After deploy, the live `/api/marta/rail` endpoint returned real arrivals in the production app — confirming the Sensitive `MARTA_RAIL_API_KEY` reads at runtime in the deployed Edge Function and that server-side key injection works end-to-end (env var → Edge runtime → upstream `:18096`/CORS path → JSON). This closes ADR-0010's last open risk (the runtime env-read); the Node-serverless-runtime fallback is not needed.

## Open questions

- _Is the API shape rich enough to support our existing UX patterns (status classification, downstream stops, occupancy) or do we need new ones?_ **Confirmed in Phase-2 (2026-07-13 snapshot):** arrivals + status + position are covered; **no per-train occupancy** field (bus has it, rail doesn't), and **no "downstream stops on this train's run"** — the feed is arrival-at-station-centric. Any such UX would need a different source.
- _Scope vs Terminus — do we ship rail because we can, or because we add something Terminus doesn't?_ Provisional answer in Problem: ship it to be viable for multi-modal commuters, keep scope tight, don't try to out-rail anyone.
- _Auth + key storage — backend proxy is required; how does it compose with the bus backend?_ Answered in Architecture: extends the ADR-0005 proxy but with a new secret-injecting threat model ⇒ **[ADR-0010](../adr/ADR-0010-secret-injecting-rail-proxy.md) (Proposed)**.
- _Favorites model — do rail stations share the favorites store with bus stops, or live separately?_ Still open; leaning unified for the multi-modal rider, pending the favorites data model review. **Deferred for the first station-detail cut** (which ships without favorites, exactly as bus did), so it doesn't block the UI — and it's the trigger that would justify extracting a shared polling engine (see the polling decision above).
- _Do we need MARTA static GTFS rail data too_ (station locations, line metadata, transfer relationships) to complement the realtime arrivals — or does the realtime feed carry enough? **Largely answered (2026-07-20 recon — see "Station identity — static-GTFS recon"):** rail (routes + all 38 stations with `stopId`s + coords) is already in `stops.json`. The realtime feed carries enough for the *station-detail page* (keyed on feed name). Static rail data is needed only for the *registry* (canonical `stopId`, coords for Nearby, bus parity) — a nightly-regenerated, drift-validated build artifact, deferred with the entry point.
