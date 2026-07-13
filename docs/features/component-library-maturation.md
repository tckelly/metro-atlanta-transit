# Component-library maturation — promote the stop/route row primitives

This is the living plan for a DRY refactor: extract the reusable UI primitives that ADR-0003 designed but that were (correctly) deferred at launch, now that real duplication has appeared. It is the prerequisite refactor for the nearby-stop disambiguator ([`nearby-stop-direction.md`](./nearby-stop-direction.md) / [ADR-0008](../adr/ADR-0008-headsign-stop-disambiguator.md)) — that feature adds a secondary line to every stop surface, and doing so cheaply requires a shared surface first.

Load-bearing decisions here spawn [ADR-0009](../adr/ADR-0009-promote-component-subset.md).

## Problem

ADR-0003 designed a rich atomic-design library (organisms `StopCard`, `RouteHeader`; molecules `ListItem`, `StatusBadge`, `TimeDisplay`). Only `BusRow` + atoms were ever built. That was the *right* call at launch — CLAUDE.md forbids preemptively extracting single-use components, and at v0.0.1 none of these had a second consumer. It was deliberate YAGNI, not an oversight.

The app has since matured, and the promotion trigger CLAUDE.md describes ("a pattern used in 2+ places belongs in the library") has fired. Measured against today's code:

- **The stop-row pattern is copy-pasted across 5 surfaces**: `NearbyStops`, `Home` search results, `FavoriteStopCard`, `RouteDetail` stop lists, and `Routes` route rows.
- **The `severity → text-status-*` color map is duplicated across 4 sites**: `FavoriteStopCard.severityClass`, `BusRowDisclosure` (two maps), and `StopDetail` staleness.
- Each copy carries its own i18n wiring, a11y affordances, and Tailwind composition, which drift independently. The disambiguator would be a 5th copy of the stop row.

### Scorecard — ADR-0003's named components graded against today's code

Objective test (CLAUDE.md): 2+ real consumers today = promote; fewer = leave deferred.

| ADR-0003 named | Status today | Consumers | Verdict |
|---|---|---|---|
| `BusRow`, atoms (`Button`, `Badge`, …) | Built | many | correct |
| `IconButton` | Folded into `Button variant="icon"` | — | superseded, not missing |
| `LastUpdatedIndicator` | Inline in `StopDetail` only | 1 | correctly still deferred |
| `ListItem` / `StopCard` | Inline, copy-pasted | **5** | **promote now** |
| `RouteHeader` (+ route row) | Inline in `Routes` + `RouteDetail` | 2 | **promote now** |
| `StatusBadge` / severity→color | Duplicated color maps | **4** | **promote now** (as `StatusText`) |
| `TimeDisplay` | Severity-colored time inline | 2 | marginal; folds into `StatusText` |

The takeaway: ADR-0003 wasn't stale, it was *early*. Its destination was right; its timing was correctly deferred. We now promote only the evidence-backed subset — not the whole named list (that would repeat the original speculation in reverse).

## Two container idioms (the thing to unify)

The same "stop link" entity renders through **two** different container treatments today:

- **Idiom A — standalone card** (Nearby, Favorites): each row is its own `rounded border border-divider bg-surface-elevated`, spaced with `space-y-*`, `hover:border-primary`.
- **Idiom B — divided list** (Search, RouteDetail stops, Routes): one bordered container, items are `block px-4 py-3` under `divide-y`, `hover:bg-surface`.

Two visual treatments for one entity is itself drift. The refactor keeps both alive initially (via a `density` prop) to stay behavior-preserving, then **tests removing `density`** by unifying onto one idiom (Phase B below). Simpler is the goal; `density` is provisional, not a destination.

## Design

### Prop shape — `ListItem` molecule (presentational, router-agnostic)

```ts
// @atl-transit/components — molecules/ListItem
interface ListItemProps {
  title: ReactNode;          // primary line
  secondary?: ReactNode;     // directions / longName / arrival preview — a slot, not typed
  trailing?: ReactNode;      // walk-time text | chevron | reorder buttons
  leading?: ReactNode;       // route badge (future) — omit until a 2nd consumer needs it
  interactive?: boolean;     // apply hover/focus affordance; parent supplies the actual nav
  variant?: 'card' | 'row';  // 'card' = idiom A (own border+radius); 'row' = idiom B (flush for divide-y). (Named `density` during Phase A; renamed — see Phase B.)
}
```

Plus a small **`StatusText` atom** (or an extension of `Badge`) that owns `severity → text-status-*`, retiring the 4 duplicated maps.

### Boundary: the library never imports the router

`ListItem` is presentational and link-agnostic — it renders layout + an `interactive` affordance flag only. The **web package owns `<Link>` wrapping** (or omits it, e.g. Favorites reorder mode). Rationale: ADR-0003's portability goal and ADR-0002's package boundaries both forbid `@atl-transit/components` depending on the web app's `react-router`. Routing is app-composition, not a component concern. (Decided; see ADR-0009 alternatives — a polymorphic `as` prop was rejected as leaking routing awareness into the library.)

### Web-side domain→visual wrappers (ADR-0003 boundary)

- **`StopCard`** — `StopOut` → `ListItem` (title=name, secondary=directions line via a `directions→routes.json` mapper), wrapped in `<Link to={/stop/:id}>`.
- **`RouteRow`** — `RouteOut` → `ListItem` (title=shortName, secondary=longName), `<Link to={/route/:id}>`.
- **`FavoriteStopCard`** — `ListItem density="card"` with its existing stateful arrival-preview body as `secondary` and its `RightSlot` as `trailing`; `interactive` only in browse mode. **Not** collapsed into a uniform `StopCard` — its multi-state body would make that a god-component.
- **StopDetail header** — an `<h1>`, *not* a `ListItem`. It reuses the `directions→text` **mapper** (the reuse unit there is the function, not the shell).

## Migration sequence (behavior-preserving; suite stays green)

**Phase A — extract + migrate onto `density`:**

1. Build `ListItem` + `StatusText` in `@atl-transit/components`, TDD in isolation (red first).
2. Migrate the idiom-B **stop** links — **RouteDetail stops, Search**. Proves `density='row'`. *(Done — behavior-preserving; existing Home + RouteDetail suites green, incl. axe.)*
   - **Routes deferred.** Migration surfaced that `Routes.tsx` renders a *route* row (inline short-name + long-name), not a stop row, and it's the **only** consumer of that shape. Forcing it into `ListItem`'s stacked title/secondary would either change its look or grow the primitive an inline mode — both fail behavior-preservation and the 2+-consumer rule. Left inline (same reasoning as deferring `LastUpdatedIndicator`); revisit if a second route-row consumer appears.
   - **Minor visual normalization accepted:** the migrated stop rows now share one style — name is `font-medium` (was `text-fg`/plain across surfaces) and the search routes line is `text-sm` (was `text-xs`). Standardizing divergent per-surface styling is the point of the refactor, not a regression.
3. Migrate **Nearby** (card + trailing walk-time). Proves `density='card'` + trailing slot.
4. Migrate **FavoriteStopCard** last (stateful body, swapping trailing, link/no-link). *(Done — adopts `StatusText`, not `ListItem`; see finding below. Existing suite green.)*
   - **Finding: favorites adopts `StatusText` but not `ListItem`'s layout.** Attempting the `ListItem` migration surfaced that the favorite card's layout is genuinely distinct — a multi-line stateful body (name + arrival preview) beside a *full-height, fixed-width right column* that swaps chevron↔reorder buttons with no reflow between modes. `ListItem` models a padded, baseline-aligned row with a short trailing slot; representing the favorites layout would require either degrading the reorder affordance or adding a speculative padding/alignment prop for a single consumer. So favorites keeps its bespoke shell (as ADR-0009 anticipated — "not a uniform StopCard, its multi-state body would make that a god-component") and takes the real DRY win: its `severityClass` helper is retired in favor of the shared `StatusText` atom (one of ADR-0009's 4 severity-map sites). `whitespace-nowrap` stays at the call site, since it's a layout concern `StatusText` deliberately doesn't own.

5. **Finish the `StatusText` consolidation** — *investigated; the remaining 3 sites do not fit `StatusText`, and ADR-0009's "4 sites" turns out to be an overcount.* Findings:
   - `BusRowDisclosure` `PRIMARY_SEVERITY_CLASS` is composed with `text-2xl font-bold leading-tight` + `line-through` — it duplicates **`BusRow`'s own `primaryStyles` cva**, not a status-text case. The right consolidation is reusing `BusRow`'s primary styling, a separate (larger) job; `StatusText` can't express it.
   - `BusRowDisclosure` `ICON_SEVERITY_CLASS` colors an **icon** and uses `neutral = text-fg-muted` (vs `StatusText`'s `text-fg`). Not text; different neutral. Doesn't fit.
   - `StopDetail` `TIER_CLASS` is a **domain** `FreshnessTier` map (`fresh = text-fg-muted`); routing it through `StatusText` would change `fresh`'s color, and it lives in `LastUpdatedIndicator` — the single-consumer component ADR-0009 deliberately deferred. Out of scope.

   **Resolution — kept on semantic grounds, not consumer count.** The finding drops `StatusText` to 1 genuine consumer (FavoriteStopCard), which would fail the 2+ rule. But that rule is a proxy for "real concept vs. speculative extraction," and `StatusText` is a real concept: it's the **inline-text member of the `severity` family** ADR-0003 established — `Badge` renders severity as a pill, `BusRow` primary as the headline, `StatusText` as inline body text — and it **centralizes the `severity → text-status-*` design-token binding** that CLAUDE.md wants centralized ("a brand refresh should be a single edit"). It is kept because it completes a token-backed vocabulary, not because a consumer count was reached. The 3 non-fitting sites are left alone. The `ListItem` extraction (3 consumers) is unaffected and stands.

   **Record correction for [ADR-0009](../adr/ADR-0009-promote-component-subset.md).** The ADR is Accepted/immutable, so this note reconciles rather than edits it: ADR-0009's stated `StatusText` rationale ("retires the 4 duplicated color maps") is an **overcount** — only FavoriteStopCard fit. `StatusText` remains justified, on the better rationale above (severity-family completeness + token centralization). A superseding correction ADR is optional and probably heavier than warranted, since the decision *to build `StatusText`* did not reverse — only its rationale is corrected.

Existing tests assert text/roles (behavior, per CLAUDE.md), so they should survive each step; a test that asserts DOM structure is a signal to double-check semantics were preserved.

**Phase B — test removing `density` (the simplification): _spiked → keep `density`._**

6. Attempted the unification and researched it against the design record. **Conclusion: do not remove `density` — it encodes a documented, deliberate UX distinction, not drift.**
   - After Phase A, `density='card'` has exactly **one** `ListItem` consumer (Nearby); `density='row'` has two (Search, RouteDetail stops). Favorites is not a `ListItem` consumer. So removal reduces to a single question: *can Nearby move to the divided-list idiom?*
   - **`ux-guidelines.md` answers it: no.** The home-screen wireframe (the "Home / entry point" screen) specifies **stop *cards*** for *both* Favorites and Nearby, and there is a dedicated "Stop card (favorites view, home screen)" component spec. The card idiom is the home-screen treatment; the divided list is the browse/search/route-stops treatment. The two idioms map to a real semantic: **prominent, tappable cards for the short high-value home lists** vs **dense enumeration for long browse lists**.
   - Forcing one idiom would regress something: Nearby→list breaks the documented home-screen card layout *and* home-screen coherence with Favorites (which must stay cards for the reorder affordance); Search/Routes→cards is bad for long lists. So `density` is a legitimate variant that lets one `ListItem` serve both documented treatments.
   - **Reclassified from "provisional" to permanent + semantic, and renamed `density` → `variant`.** This supersedes ADR-0009's "provisional, slated for a unification test" framing (its *Revisit when* anticipated exactly this outcome: "if a surface genuinely needs the other idiom, keep it"). Because the prop is a permanent visual form (not a compactness scale), it was renamed `density` → **`variant`** — matching `Button`'s house convention — with a docstring stating the semantic (`card` = prominent home-screen stop card; `row` = dense list enumeration) so it doesn't read as arbitrary.
   - **Follow-up (done):** since we're keeping both idioms, the Nearby card's missing focus-visible ring (noted in step 3, deferred pending this decision) was fixed — its `<Link>` now carries the same `focus-visible:ring-2 focus-visible:ring-primary` as the row surfaces, plus `rounded` so the ring hugs the card. Purely visual (the anchor was already keyboard-focusable), so no new test; existing Nearby + Home-axe suites are the gate.

**Then (separate feature/PR — not this refactor):**

6. The disambiguator: build-time `directions` enrichment on `StopOut` + pass `secondary` on Nearby, Search (replacing its routes line), and the StopDetail header. Skip Favorites (already shows headsigns via live arrivals) and RouteDetail (already grouped by headsign).

7. **Follow-up — `DirectionLabel` extraction + format unification.** The disambiguator's visible-glyph + spoken-`aria-label` pairing was promoted into a presentational `DirectionLabel` component (router-agnostic, `as='span' | 'p' | 'h2'`), with `formatDirectionPair` factored out of `formatDirections`. It was then applied to two existing direction displays that had drifted into other styles — the StopDetail route-group header and the Favorites arrival preview — so the `route → headsign` format and its a11y contract live in one place instead of being re-wired per surface. Same "the reuse unit is the mapper/label, not the shell" pattern already noted for the StopDetail header above. (Design + as-built detail: [`nearby-stop-direction.md`](./nearby-stop-direction.md).)

## Test strategy

- `ListItem` / `StatusText`: unit tests in `@atl-transit/components`, asserting rendered text/roles and the `interactive`/`density` variants — not class strings.
- Each surface migration: rely on the existing feature tests as the behavior-preservation gate; add coverage only where a surface gains a slot it didn't test before.
- Full `pnpm test` + `pnpm typecheck` + `pnpm lint` at the end of Phase A and again after Phase B (catches `eslint-plugin-boundaries` fallout — e.g. an accidental router import in the library).

## Open questions

- **Does `density` survive Phase B?** The whole point of step 5 is to answer this empirically. Hypothesis: idiom B (divided list) can absorb Nearby and Favorites with a spacing tweak, but Favorites' card affordance (tap target, reorder) may justify keeping the card. TBD by trying it.
- **`StatusText` vs. extending `Badge`.** `Badge` is a pill; the duplicated usage is colored *inline text*, not a pill. Likely a distinct `StatusText` atom, but confirm they shouldn't merge.
- **`leading` slot.** Reserved for a route badge/number but has no 2nd consumer yet — omit until one appears (don't re-commit the original over-extraction mistake).

## Alternatives considered

- **Build ADR-0003's full named list now.** Rejected — repeats the launch-era speculation in the opposite direction. Promote only what has 2+ consumers.
- **Keep inlining / do nothing.** Rejected — 5-way drift compounds with every new stop-surface feature; the disambiguator is already the trigger.
- **Big-bang rewrite of all surfaces at once.** Rejected — higher risk, harder to keep the suite green. Incremental, one-surface-at-a-time migration is safer.
- **Polymorphic `as` prop / `<Link>` inside the library.** Rejected — leaks routing awareness into a package that ADR-0003/0002 keep portable and domain-free.
