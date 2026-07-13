# ADR-0008: Headsign as the stop-direction disambiguator

**Status:** Accepted
**Date:** 2026-07-12

## Context

MARTA gives both directions of an intersection the same `stop_name` — the two opposite-curb stops are distinct GTFS records (distinct `stop_id`, coordinates ~10–25 m apart) but byte-identical names. Measured against the static GTFS, **48.7% of all stops share their exact name with at least one other stop** (1,598 simple pairs, plus some triples/quads). In surfaces that render stops by name — the Nearby list, stop search, favorites, the StopDetail header — these appear as indistinguishable duplicate rows with no basis for the rider to pick the correct curb. Choosing wrong sends them to the opposite direction of travel.

We need a per-stop label that tells the rider *which direction* a stop serves, and it has to satisfy the design north stars: glanceable in ~2 seconds, robust across ~7,000 stops, and cheap enough to not regress the "answer in under two seconds from cold open" goal.

The full design conversation — collision data, cardinality analysis, cost — lives in [`docs/features/nearby-stop-direction.md`](../features/nearby-stop-direction.md). This ADR records only the load-bearing choice, because the obvious-looking alternative (compass direction) is one a future contributor would be tempted to reach for.

## Decision

**Use the GTFS `trip_headsign` as the stop-direction disambiguator, rendered as `route → headsign`** (e.g. `11 → Collier Rd`). The route number is the *identifier* ("is my bus here at all?"); the headsign is the *disambiguator* ("which direction?"). It is the transit-industry-standard signal and, crucially, it's the string lit on the front of the approaching bus — a rider can match it to the vehicle even without knowing the surrounding geography.

Concretely:

- The disambiguator is **precomputed onto `StopOut`** during the nightly build and shipped in the client `stops.json`. This is a direct *application* of ADR-0004 (build-time GTFS preprocessing) and ADR-0006 (small reference data on the client, big tables on the backend) — not a new architectural decision. The per-stop set of `(routeId, headsign)` pairs is derived from the same `stop_times ⋈ trips` join that already produces `routeIds`. The backend SQLite is unchanged; we only read it at build time.
- **Always shown** when direction data exists (name-only fallback otherwise), not conditional on a visible collision — a stop reads identically across every surface, and the label is useful orientation even without a visible twin.
- **Multi-pair stops** (a stop serving 2+ `(route, headsign)` pairs — ~22% of collision-group stops) render top-N pairs then "+N more". Truncation is correctness-safe: measured across every adjacent same-name multi-pair collision, there are zero cases where truncation hides the distinguishing pair (the residual collisions are stops serving genuinely identical service).

## Alternatives considered

**Cardinal direction from geometry ("Eastbound").** The most appealing on first glance — universally legible, no knowledge of the map required. Rejected because any bearing derived from stop geometry is fragile exactly where it's needed most: a stop→next-stop bearing points "the wrong way" wherever routes zigzag around intersections, shopping centers, or parks, and those dense areas are where same-name stops cluster. A stop-to-final-stop bearing is worse (meaningless on curving or loop routes). The heuristic would mislead in precisely the situations disambiguation matters, so its legibility isn't worth the wrong-answer risk. This is the alternative most likely to be re-proposed; recording it here is the main reason this ADR exists.

**Route number alone.** Fails the core case — opposite-curb twins serve the *same* route (both Virginia Ave curbs are Route 11), so route number can't tell them apart. Retained as the *identifier* half of `route → headsign`, never as the disambiguator.

**Collapse same-name curbs into one "stop group" row.** Cleaner list, but the app is keyed on `stopId` (`/stop/:stopId`); a group concept is a substantially larger change, and auto-picking the nearest curb risks routing the rider to the wrong direction. Deferred; revisit only if `route → headsign` labeling proves insufficient.

**Query the backend for the label at request time instead of precomputing.** Would inject a network round-trip into the Nearby/search/favorites path, which is currently backend-free and offline-capable, to serve data that only changes when MARTA republishes GTFS (nightly). Rejected as an anti-application of ADR-0004/0006.

## Consequences

**Pros:**

- Glanceable and robust: no geometry heuristics, no wrong-direction failure mode. The label matches the physical bus's headsign, which is what a rider reconciles against at the curb.
- Cheap: +~25 KB gzipped on `stops.json` (135 → 159 KB), a one-time service-worker-cached download; no per-request or backend cost, no effect on the realtime polling path. Build-time cost is one extra aggregation in an already-existing join.
- Reuses the established pattern (ADR-0004/0006) rather than introducing infrastructure; benefits every stop-name surface at once because the data rides `StopOut`.

**Cons / accepted trade-offs:**

- Some MARTA headsigns are opaque cross-street names ("Collier Rd") that don't teach geography. Accepted because the headsign still matches the physical bus; a downstream-landmark enrichment (`→ Collier Rd · via Ponce de Leon`) is a possible phase-2 follow-up, not part of this decision.
- ~0.75% of adjacent same-name pairs serve a genuinely identical set of routes *and* headsigns (e.g. two P&R boarding bays, or a pair both feeding the same terminal station). Headsign cannot separate these; they render identical lines. Disambiguating them needs a non-headsign cue (bay / side-of-street) — deep enough in the tail to defer.
- Always-showing adds slight baseline visual density on every stop row; treated as a visual-tuning matter (muted/smaller secondary line), not a reason to make rendering conditional.
- Forecloses little: the label is a derived field, so reversing or swapping the disambiguator later is a preprocess + render change, not a data migration.

## Revisit when

- Real user feedback says headsigns are too opaque to act on — promote the phase-2 downstream-landmark enrichment.
- The ~12 genuinely-non-disambiguable pairs generate real confusion — add a non-headsign cue (bay number, side-of-street).
- MARTA changes how it populates `trip_headsign` (quality, coverage, or starts populating `TranslatedString`), which would change what the label can carry.
- Someone proposes cardinal direction again — read this ADR first; the geometry-fragility rejection stands unless the input data (e.g. shape-based bearings rather than next-stop bearings) materially changes.
