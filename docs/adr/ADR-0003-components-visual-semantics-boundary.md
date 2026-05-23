# ADR-0003: Atomic-design components package with visual-semantics boundary

**Status:** Accepted
**Date:** 2026-05-23

## Context

The webapp (`@atl-transit/web`) consumes UI components from `@atl-transit/components`. We need to decide how strictly the components package separates from app-domain knowledge.

The choice hinges on a single design question: **does `<BusRow>` accept domain-specific props or visual-semantic props?**

- **Domain-specific:** `<BusRow status="cancelled" scheduledTime={...} />` — the component knows about MARTA's `live | cancelled | no_live_data` taxonomy.
- **Visual-semantic:** `<BusRow severity="danger" primaryText="..." />` — the component knows only about visual categories; the webapp maps domain → visual.

This decision repeats for every organism in the library (StopCard, RouteHeader, etc.) and shapes how reusable the components package is and how verbose the webapp's feature code is.

## Decision

**Atomic-design organization** within `packages/components` — three tiers:

- `atoms/` — visual primitives (Button, Badge, Icon, Spinner, Skeleton, Text)
- `molecules/` — small combos of atoms (IconButton, StatusBadge, TimeDisplay, ListItem)
- `organisms/` — meaningful chunks composing molecules (BusRow, StopCard, RouteHeader, LastUpdatedIndicator)

**Templates and pages are excluded.** Page-level composition belongs in `packages/web/src/pages/`.

**Visual-semantics boundary (the "Option B" we discussed):** components accepts visual-only props like `severity: 'success' | 'warning' | 'danger' | 'neutral'`. It does not know about `live | cancelled | no_live_data`. The webapp maps domain → visual at the feature container layer:

```ts
// packages/web/src/features/stops/busRowMapper.ts
export function toBusRowProps(row: BusRow): BusRowProps {
  switch (row.status) {
    case 'live':       return { severity: 'success', /* ... */ };
    case 'cancelled':  return { severity: 'danger',  /* ... */ };
    case 'no_live_data': return { severity: 'neutral', /* ... */ };
  }
}
```

## Alternatives considered

**Domain-specific props (Option A).** `<BusRow status="cancelled" />`. Rejected because it permanently couples the components package to MARTA's taxonomy. The day a sibling app appears — or the day we consider open-sourcing the library, or extracting it for a different transit system — every organism would need its prop shape rewritten.

**Flat components folder (no atomic-design tiers).** All components in `packages/components/src/`, no atom/molecule/organism subdivision. Rejected because the atomic-design vocabulary is widely understood, and the folder tier itself communicates composition complexity to a new reader at a glance. Treating it as a guideline (not a rigid contract) avoids the worst over-classification pitfalls.

**Full atomic design with templates + pages.** Including layout-level scaffolding in the library. Rejected because templates and pages are app-specific composition concerns — they belong in `packages/web/src/pages/`, not in a reusable component package.

## Consequences

**Pros:**

- The components package is genuinely portable. The day a sibling app appears (mobile wrapper, admin tool, marketing site), it consumes the same components without dragging in MARTA-specific types.
- The visual contract is clean. Designers, design-system reviewers, or external consumers can understand the props without knowing what MARTA is.
- TypeScript catches unhandled domain cases in the mapper functions (when domain types are discriminated unions).
- The components library can evolve independently of MARTA's data shape changes.

**Cons:**

- Every BusRow (and StopCard, etc.) consumer in the webapp writes a domain → visual mapping. Verbose at call sites.
- The mapping is a place to forget cases. Without TypeScript discipline (discriminated union exhaustiveness), bugs slip through.
- Reading feature code requires two hops to understand: the domain shape, plus the mapper that converts it to visual props.

**Mitigations:**

- Domain types are defined as discriminated unions, so TypeScript flags non-exhaustive `switch` statements in mappers.
- Mappers live in `features/*/` next to where they're called — not centralized in a way that hides the relationship.
- For especially common conversions, a per-feature helper (`useBusRowProps()` hook or similar) can encapsulate the mapping into the existing data fetching layer.

## Revisit when

- The verbosity becomes a tax — feature code feels mostly like mapping logic. The escape hatch is to allow *organisms* to accept slightly higher-level props (still no direct MARTA types in the library; perhaps semantic enums that map 1:1 to domain states without naming them).
- A second app appears and validates (or invalidates) the portability assumption. If the second app maps to the same visual taxonomy with no friction, the trade-off was worth it. If it doesn't, reconsider.
- We decide to publish the components package to npm — at which point this decision becomes structurally locked in.
