# ADR-0009: Promote the evidence-backed component subset (ListItem/StopCard, RouteRow, StatusText)

**Status:** Accepted
**Date:** 2026-07-12

## Context

ADR-0003 designed a rich atomic-design library (organisms `StopCard`, `RouteHeader`; molecules `ListItem`, `StatusBadge`, `TimeDisplay`) but only `BusRow` + atoms were ever built. That deferral was correct, not an oversight: CLAUDE.md forbids preemptively extracting single-use components ("promote once a second consumer appears"), and at v0.0.1 none of these had a second consumer. Building them then would have meant designing prop shapes against one imaginary consumer — exactly the speculative over-engineering the same doc warns against. (Evidence it would have gone wrong: `IconButton`, one of ADR-0003's named molecules, turned out to be better solved as `Button variant="icon"` — a shape we'd not have guessed up front.)

The app has since matured and the promotion trigger has fired. Measured against today's code:

- The stop-row pattern is copy-pasted across **5 surfaces** (`NearbyStops`, `Home` search, `FavoriteStopCard`, `RouteDetail` stops, `Routes` rows).
- The `severity → text-status-*` color map is duplicated across **4 sites** (`FavoriteStopCard`, `BusRowDisclosure` ×2, `StopDetail`).

The nearby-stop disambiguator ([ADR-0008](./ADR-0008-headsign-stop-disambiguator.md)) adds a secondary line to every stop surface — a 6th reason to touch all of them, and a 5th copy of the row if we inline it again. The full plan lives in [`docs/features/component-library-maturation.md`](../features/component-library-maturation.md); this ADR records only the load-bearing choices.

## Decision

**Promote only the subset with 2+ real consumers today**, and no more:

- A **`ListItem` molecule** (the shared row shell) plus thin web-package wrappers `StopCard` (`StopOut` → `ListItem`) and `RouteRow` (`RouteOut` → `ListItem`).
- A **`StatusText` atom** owning `severity → text-status-*`, retiring the 4 duplicated color maps.
- **`ListItem` is presentational and router-agnostic.** It renders layout + an `interactive` affordance flag; the web package owns `<Link>` wrapping and the domain→visual mapping (ADR-0003 boundary). The library never imports `react-router`.
- A provisional **`density: 'card' | 'row'`** prop preserves the two existing container idioms so the extraction is behavior-preserving. `density` is explicitly transitional: a follow-up step tests removing it by unifying the idioms (see *Revisit when*).

**Explicitly not built** (deferral still correct): `LastUpdatedIndicator` (1 consumer), `IconButton` (already solved as `Button variant="icon"`), a `leading` slot (no 2nd consumer yet).

The durable rule this records: **promote at the 2nd consumer, not before, and only what has one.** This refines ADR-0003 on *timing*; it does not overturn its design.

## Alternatives considered

**Build ADR-0003's full named list now.** Rejected — repeats the launch-era speculation in the opposite direction, re-committing the very over-extraction CLAUDE.md warns against. Promote the evidence-backed subset only.

**Keep inlining / do nothing.** Rejected — 5-way stop-row drift and 4-way severity-map drift compound with every new stop-surface feature; the disambiguator is already the forcing function.

**A polymorphic `as` prop, or `<Link>` inside `ListItem`.** Rejected — leaks routing awareness into a package that ADR-0003 keeps portable and ADR-0002 keeps boundary-isolated. Routing is app-composition; the web package supplies the navigation wrapper around a presentational primitive.

**Big-bang migration of all surfaces in one change.** Rejected — higher risk and harder to keep the suite green. Incremental, one-surface-at-a-time migration (idiom-B links first, then Nearby, then the stateful Favorites card) keeps each step behavior-preserving.

**Collapse `FavoriteStopCard` into a uniform `StopCard`.** Rejected — its multi-state live-arrival body and swapping reorder affordance would make a single `StopCard` a god-component. Favorites instead *composes* `ListItem` (shell + slots) and keeps its bespoke body.

## Consequences

**Pros:**

- Kills 5-way stop-row drift and 4-way severity-map drift; i18n, a11y, and Tailwind composition live in one place. New stop-surface features (starting with the disambiguator) become a one-line slot addition.
- Completes the architecture ADR-0003 designed, on evidence rather than speculation, and records the promotion criterion so the next contributor neither over- nor under-extracts.
- Library stays portable and domain-free; the visual-semantics boundary (ADR-0003) and package boundaries (ADR-0002) hold.

**Cons / accepted trade-offs:**

- A behavior-preserving refactor PR lands before the disambiguator ships — real cost, but the debt is already 5 surfaces deep and only grows.
- `density` temporarily keeps two container idioms alive, deferring (not resolving) the "stops should look identical everywhere" question to the Phase B simplification step.
- Forecloses little: these are additive primitives; reversing is deleting a component and re-inlining, not a data migration.

## Revisit when

- **Phase B lands.** If unifying the container idioms succeeds, `density` is deleted and this consequence updates; if a surface genuinely needs the second idiom, `density` stays and the reason is recorded here.
- A 2nd consumer appears for `LastUpdatedIndicator`, or a `leading`-slot need appears — promote them then, same criterion.
- The components package is published to npm — at which point the router-agnostic boundary becomes structurally locked in.
- A 3rd container idiom appears — reconsider whether `density` is the right abstraction or whether the surfaces have genuinely diverged.
