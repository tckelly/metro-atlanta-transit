# Nearby stop direction / disambiguation

Two physically distinct GTFS stops routinely share a byte-identical name — one per direction of travel, on opposite curbs of the same intersection. In the Nearby list this reads as a duplicate-bug: e.g. `VIRGINIA AVE NE @ MARYLAND AVE NE` appears twice, same walk time, nothing to tell them apart. This doc is the design conversation for giving each stop a glanceable disambiguator so a rider can pick the correct curb.

This is a living design conversation — edit the sections below as decisions land. Load-bearing decisions spawn ADRs (linked inline from the relevant section).

## Problem

The commuter in `personas-and-jobs.md` opens the app at a stop and wants "which stop do I walk to?" answered in two seconds. Today the Nearby list shows stop **name + walk time** only. Because MARTA gives both directions of an intersection the same `stop_name`, the rider sees what looks like a duplicated row and has no basis to choose. Picking wrong sends them to the opposite-direction curb — a real failure of the glanceable / best-in-class-bus-UX north stars.

This is not a rare edge. Measured against the generated static GTFS:

- **48.7% of all stops** (3,437 of 7,052) share their exact name with at least one other stop.
- 1,675 collision groups; **1,598 are simple pairs** (the classic two-curb case), plus 69 triples, 6 quads, 2 quints.

Nearly half the network has a name twin, so this is systemic, not a one-off.

**Scope note:** in a *Nearby* list, only same-name stops that are *both within walking distance* ever collide on screen. Generic names reused across the city (some of the triples/quints) never co-occur in a 5-nearest list, so the acute problem is the physically-adjacent opposite-curb pair.

## Data

Verified against the generated `api/_data/gtfs.sqlite` (trips + stop_times) and `public/gtfs/stops.json`.

**The pairs are opposite directions, not redundant.** For the three Virginia Ave pairs, each curb serves exactly one direction of Route 11:

| Curb | direction_id | headsign |
|---|---|---|
| `904257` | 0 | Executive Park |
| `904777` | 1 | Collier Rd |

They are 11–24 m apart on the *same* route — so the two rows represent a genuine choice (which way am I going?), and the fix is to *label direction*, never to dedupe.

**What disambiguates, and what doesn't:**

- **Route number does *not* disambiguate the pair** — both curbs are Route 11. Route number answers a *different* question ("is my bus even here?"), and both twins answer it identically.
- **Headsign *does* disambiguate** — `→ Collier Rd` vs `→ Executive Park`. It is the transit-standard direction signal and, critically, it's the string lit on the front of the approaching bus, so a rider can match it to the vehicle even without knowing where Collier Rd is. This is the load-bearing choice, recorded in [ADR-0008](../adr/ADR-0008-headsign-stop-disambiguator.md).
- **Cardinal direction was considered and rejected.** It reads well ("Westbound") but any geometry-derived bearing is fragile exactly where stops cluster — routes zigzag around intersections, shopping centers, and parks, so the next-stop bearing can point "the wrong way." Not worth the heuristic risk. (See *Alternatives considered.*)

**Headsign/direction cardinality per stop** (why this isn't always one clean string):

| Distinct headsigns per stop | Share |
|---|---|
| 1 | 78% |
| 2+ | 22% (long tail to 9) |

direction_id is more stable (90% of stops serve a single direction_id), but `0/1` is not human-readable on its own.

**`(route, headsign)` pairs for stops in a name-collision group** — this is what a row must render:

| pairs | share | render |
|---|---|---|
| 1 pair | **78.4%** (2,667) | clean single line: `11 → Collier Rd` |
| 2+ pairs | 21.6% (735) | needs compact / "+N more" |

Of the 735 multi-pair stops: 434 are both multi-route *and* multi-headsign (busy downtown-style stops), 240 multi-headsign only, 61 multi-route only. Because physically-adjacent collisions are overwhelmingly the single-pair case, the clean render covers what the rider actually sees; the multi-pair treatment is a bounded, rarer case.

## UX

Render the disambiguator as **`route → headsign`** — route number as the identifier ("is this my bus?"), headsign as the tie-breaker ("which direction?"). This mirrors the convention riders already know from Transit / Google Maps.

- **Always shown** when direction data exists (name-only fallback otherwise) — *not* conditional on a visible name-collision. A stop should read identically in Nearby, search, favorites, and its own header, and the label is useful orientation ("this stop's buses go toward Collier Rd") even with no visible twin. The only cost is slight baseline density, a visual-tuning matter.
- **Single-pair stop (the 78% / real Nearby collisions):** one secondary line under the name, e.g. `11 → Collier Rd`.
- **Multi-pair stop:** show up to N pairs then "+N more" (exact N TBD — see open questions), or group by route and list its headsign(s).
- **Where it lives:** the same ambiguity exists everywhere a stop name renders — Nearby, search results, favorites cards, the StopDetail header. So the disambiguating data should be a field on `StopOut` (see *Data pipeline* below), surfaced by whichever views want it, not computed per-component.
- **Accessibility:** the secondary line is real content, not decoration — a screen reader should hear "Virginia Ave at Maryland Ave, Route 11 toward Collier Rd." Keep it in the accessible name/description, not an `aria-hidden` flourish.
- **Visual-semantic boundary (ADR-0003):** `route → headsign` is domain text, mapped to a presentational secondary-line/byline slot at the web-package boundary; the component library stays domain-free.

## Data pipeline — precompute, don't query at request time

The disambiguator is baked onto `StopOut` at **build-time preprocessing**, shipped inside `stops.json`, *not* generated by querying the backend SQLite at request time. Rationale:

- **Nearby / search / favorites are backend-free and offline-capable today.** They rank and render entirely over the service-worker-cached `stops.json` with zero network round-trips. Querying the DB per render would inject latency into a path that's currently instant and works offline — straight against the 2-second / PWA north stars. (Consistent with ADR-0006's client/backend split: small, everywhere-needed static data lives client-side; big per-trip tables stay on the backend.)
- **The data is static.** Per-stop headsigns change only when MARTA republishes GTFS (nightly). Re-deriving it per request re-computes the same answer thousands of times for data that changes once a day.
- **The join is the expensive part.** Per-stop `(route, headsign)` needs `stop_times` (huge) ⋈ `trips`. Preprocessing amortizes that to one nightly build; `routeIds` is *already* computed onto `StopOut` this exact way (ADR-0004), so this is a natural extension of an established pattern, not new architecture.
- **Cost/limits.** Function GB-hours / invocations are the Hobby-tier constraint (see `roadmap.md`); a static CDN asset is effectively free and off the function budget.

So the backend SQLite is **unchanged** — it already holds `trips` + `stop_times` + `headsign`; we only *read* it at build time. The enrichment lands in the client bundle.

### Cost of the enrichment

Measured by building the enriched `stops.json` and gzipping:

- `stops.json`: 782 KB → ~1,218 KB raw; **135 KB → 159 KB gzipped (+25 KB over the wire)**.
- One-time download, service-worker-cached, long-lived static asset — not per-poll, unrelated to the realtime `tripupdates` polling path.
- Build-time cost: one extra `stop_times ⋈ trips` aggregation in the nightly preprocess, off the critical path.

Headsigns repeat heavily across a route's stops, so gzip crushes the 347 KB of raw added text down to ~25 KB. No need for a headsign lookup table / interning unless the raw size later becomes a concern (premature now).

## Implementation pointers

For the agent picking this up cold:

- **Where the label is computed:** `packages/web/src/buildtime/preprocessGtfs.ts`, in `transformGtfs()`. Extend the existing `stopToRoutes` index (it walks `raw.stopTimes` ⋈ `raw.trips` to build `routeIds`) to also collect, per stop, the set of `(routeId, headsign)` pairs — `headsign` and `direction_id` already ride `RawTrip`/`TripOut`, so no new parsing. Attach the result to each `StopOut`; this is a build-time-only change (runs in the nightly preprocess).
- **`StopOut` shape (proposed — confirm in open questions):** add `directions: { routeId: string; headsign: string }[]`, deduped and sorted deterministically (suggest descending trip frequency, then routeId, then headsign, so top-N truncation is stable). Leave `directionId` off unless a consumer needs it — it isn't human-readable. Update the `StopOut` interface plus any Zod schema validating `stops.json` on the client read.
- **Consumers:** the `stops.json` readers — `NearbyStops` (`packages/web/src/features/nearby/`), stop search results, `FavoriteStopCard`, and the StopDetail header. Map domain `directions` → a presentational secondary-line/byline prop at the web boundary; do **not** leak `headsign`/`routeId` into `@atl-transit/components` (ADR-0003). Check the library for an existing byline/secondary-text slot before adding one.
- **Rendering rule:** single-pair → one line `‹shortName› → ‹headsign›` (resolve `routeId`→`shortName` via `routes.json`). Multi-pair → top-N then "+N more" (N is a layout call; truncation is correctness-safe — see Open questions). The connective glyph/words ("→", "via") go through i18n even though the headsign text itself is MARTA data and stays untranslated.
- **Tests:** `transformGtfs` is a pure function over `GtfsRaw` — TDD it against a small hand-built fixture (run red first), mirroring `preprocessGtfs.test.ts`. Assert rendered text/roles, not class strings (behavior over implementation).

## As built (v0.0.2)

Implemented on the component-library maturation refactor. Decisions locked during implementation:

- **`StopOut` shape:** `directions: { routeId: string; headsign: string }[]`, frequency-ordered (desc count, then routeId, then headsign) in `transformGtfs()`. `directionId` omitted (not human-readable). A `StopDirection` type is exported for consumers.
- **Mapper:** `utils/directionsLabel.ts` — pure `formatDirections(directions, resolveShortName, strings, maxPairs=2)`, TDD'd. Returns `{ visible, label } | null`; shows up to N pairs then `+N more`.
- **N (truncation):** **2** on every surface for now (a layout call, correctness-safe per the truncation analysis below).
- **a11y:** visible text uses the `→` glyph; each line carries an `aria-label` spoken form (`Route 11 toward Collier Rd`), since `→` reads inconsistently. The label folds into the link/​header accessible name.
- **i18n:** `directions.{pair,pairSpoken,more,moreSpoken}` in en + es; connective/"more" translated, headsign stays untranslated MARTA data.
- **Surfaces:** Nearby + Search (via `ListItem`'s `secondary` slot) and the StopDetail header. **Favorites** and **RouteDetail** skipped *for the added secondary line* — each already conveys direction (live-arrival headsigns; per-headsign grouping). Search's old routes line was **replaced**.
- **Validation:** no Zod added — `stops.json` is a trusted first-party build artifact; the recorded stance validates only untrusted boundaries (architecture.md).
- **Follow-up — shared `DirectionLabel` + format unification.** After the initial rollout, the visible-glyph / spoken-`aria-label` pairing was promoted into a presentational `DirectionLabel` component (router-agnostic, `as='span' | 'p' | 'h2'`), and `formatDirectionPair` was factored out of `formatDirections` so a single `(route, headsign)` can be formatted without the truncation machinery. The canonical `route → headsign` format was then applied to two *existing* direction displays that had drifted into other styles — the StopDetail route-group header (`Route 11 — Executive Park` → `11 → Executive Park`) and the Favorites arrival preview — so every surface that names a direction now renders and speaks it identically. (This is why "Favorites skipped" above is scoped to the *added secondary line*: favorites already showed direction, and this unified its format and a11y.)

## Open questions

- **Multi-pair rendering & the truncation trap — measured, largely a non-issue.** The worry was that truncating a multi-pair stop to "first 2 + more" could hide the pair that distinguishes it from an adjacent same-name twin. Checked empirically against every adjacent (<200 m) same-name multi-pair collision in the static GTFS: **12 cases where the top-2-by-frequency labels collide, and all 12 have *fully identical* pair sets** — i.e. zero cases where truncation is the culprit. When two adjacent same-name stops show the same top-2, it's because they genuinely serve identical `(route, headsign)` service, not because we hid the differ. So **top-N truncation is safe** (it never suppresses a disambiguating signal), and picking N is a pure layout call. The residual 12 pairs are a *different* problem (below).
- **Genuinely non-disambiguable pairs (~0.75%).** Those 12 adjacent pairs serve an identical set of routes *and* headsigns (e.g. two P&R boarding bays, or a pair that both feed the same terminal station — `HAMILTON E HOLMES DR @ SANTA BARBARA`, both stops → HE Holmes Stn). No headsign strategy separates them. They'll correctly render identical `route → headsign` lines. Disambiguating them needs a *non-headsign* cue (bay/side-of-street, a downstream landmark, or just accepting it) — but at 12 of ~1,598 adjacent pairs it's deep in the tail; document and defer.
- **How many pairs before "+N more"?** N=2? Does it differ by surface (roomier StopDetail header vs. tight Nearby row)? Now purely a layout question, not a correctness one.
- **Headsign quality.** Some MARTA headsigns are opaque cross-street names ("Collier Rd") that only mean something if you know the route. Ship headsign as-is (it still matches the physical bus), or enrich with a recognizable downstream landmark, e.g. `→ Collier Rd · via Ponce de Leon`? The landmark idea reintroduces "pick a representative downstream stop" logic with its own edge cases — likely a phase-2 follow-up, not v1 of this feature.
- **Always show, or only on collision? — Decided: always** (see UX, and ADR-0008). Conditional rendering would make the same stop look different across views and hide useful orientation; the only cost is slight baseline density, a visual-tuning matter.
- **`StopOut` shape.** Store a `directions: { route, headsign }[]` array? Dedupe/sort by what (frequency, route then headsign)? Include `directionId` for future use or omit as non-human-readable?

## Alternatives considered

- **Cardinal direction from geometry ("Eastbound").** Universally legible and doesn't require knowing the map, but derived from a stop→next-stop bearing it is fragile where routes zigzag around intersections/shopping centers/parks — the immediate next stop can point against the route's overall travel. Rejected: the heuristic misleads exactly in the dense areas where disambiguation matters most.
- **Route number alone.** Fails the core case — opposite-curb twins share the same route. Useful as an *identifier* alongside headsign, not as the disambiguator.
- **Collapse same-name curbs into one "stop group" row.** Cleaner list, but the app is keyed on `stopId` (`/stop/:stopId`); a group concept is a larger change, and auto-picking the nearest curb risks routing the rider to the wrong direction. Deferred; revisit only if `route → headsign` labeling proves insufficient.
