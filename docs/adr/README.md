# Architecture Decision Records

Short records of significant architectural decisions, the alternatives we considered, and the consequences we accepted. Originally formalized by Michael Nygard.

## What goes here

An ADR captures a decision whose **rationale** is likely to be questioned or forgotten — the kind of choice where, six months from now, someone might say "wait, why did we do X instead of Y?" and the answer matters.

Things that warrant an ADR:

- Decisions with significant downstream consequences (architecture, package layout, data flow).
- Non-obvious solutions where the obvious alternative would seem more appealing on first glance.
- Trade-offs we explicitly accepted that future-us might be tempted to revisit.

Things that don't warrant an ADR:

- Choices already explained in `vision.md`, `architecture.md`, `product-requirements.md`, or `ux-guidelines.md` and unlikely to be re-litigated.
- Coding conventions (style, naming) — those go in `CLAUDE.md` or eslint config.
- Decisions about *what* to build (those are product requirements).

## How they work

- **ADRs are immutable.** Once accepted, an ADR doesn't change. If the decision is reversed, write a new ADR with status `Accepted` and update the old one's status to `Superseded by ADR-NNNN`. The old reasoning stays visible — that's the whole point.
- **`architecture.md` is the living document**, describing the current shape of the system. ADRs are the chronological record of *why* it looks that way.
- **Numbered sequentially** in the order they're accepted: `ADR-0001-no-backend-v1.md`, `ADR-0002-monorepo-flat-packages.md`, etc.

## Format

Lightweight Nygard:

```markdown
# ADR-NNNN: Title

**Status:** Accepted | Proposed | Superseded by ADR-NNNN
**Date:** YYYY-MM-DD

## Context
Why we needed to make a decision now.

## Decision
What we decided, concretely.

## Alternatives considered
The options we evaluated and rejected, with brief rationale.

## Consequences
Trade-offs accepted. What this enables and forecloses.

## Revisit when
Concrete triggers that would warrant reopening the decision.
```

## Adding a new ADR

1. Find the next available number.
2. Create `docs/adr/ADR-NNNN-short-slug.md` from the template above.
3. Status starts as `Proposed` while it's being debated, moves to `Accepted` once committed.
4. Reference it from `architecture.md` (or wherever it's load-bearing) so readers can find it.
