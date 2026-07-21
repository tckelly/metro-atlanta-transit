# ADR-0011: Accept MARTA's authoritative computed times/delay for rail

**Status:** Proposed
**Date:** 2026-07-20

## Context

We're building the client service (`services/martaRail.ts`) that normalizes the rail proxy's response into a trimmed DTO (see `docs/features/rail.md`, ADR-0010). That work forces a decision about *who computes the numbers a rider sees* — the ETA countdown and the schedule deviation.

The two feeds answer this differently, and the difference is not cosmetic:

- **Bus.** The GTFS-RT feed gives us predicted arrival **timestamps**. We hold the static GTFS schedule (ADR-0004/0006), so we compute delay ourselves — `delaySec = predictedTime − scheduledTime` (`busRowClassifier.ts`) — and derive the ETA from an absolute `predictedTime − nowSec`.
- **Rail.** The RTT feed is **arrival-centric** (Phase-2 recon, `sample-data/marta-rail-2026-07-13/`): each record carries `WAITING_SECONDS` (ETA) and `DELAY` (schedule deviation, `T<sec>S`) **already computed by MARTA**, plus a feed-level `EVENT_TIME`. It carries no scheduled-vs-predicted pair, and we have **not** wired a rail static-GTFS join. So we cannot recompute these values the way we do for bus without first building schedule machinery for rail that doesn't exist yet.

There's also a freshness subtlety unique to rail: `WAITING_SECONDS` is measured **relative to `EVENT_TIME`**, not to "now." With the proxy's edge cache (`s-maxage=10, stale-while-revalidate=30`) a client can receive a payload up to ~40s old, and a raw countdown would then be stale on arrival and would freeze between polls — unlike the bus path, whose absolute `predictedTime` stays honest as the local clock ticks.

The decision matters because it sets an **intentional asymmetry** — we compute bus delay but accept rail delay — that a future maintainer would otherwise read as an inconsistency to "fix."

## Decision

**For rail, treat MARTA's computed `WAITING_SECONDS` and `DELAY` as authoritative and consume them as-is (parsed), rather than recomputing from a rail static schedule. Anchor the relative ETA to an absolute arrival timestamp at the service boundary.**

Concretely, in `services/martaRail.ts`:

- **`delaySeconds`** comes straight from the feed's `DELAY` (`/^T(-?\d+)S$/` → signed integer; positive = late, `0` = on time, negative = early). We do **not** diff a predicted time against a static rail schedule to derive it. Optional in the DTO — it exists only on real-time records.
- **`arrivalTime`** (unix seconds) is derived as `parse(EVENT_TIME) + WAITING_SECONDS`. This is a pure re-anchoring of MARTA's own number to MARTA's own timestamp — **not** a recomputation of the value — so it stays within "trust MARTA's figures." It gives us two things:
  1. **Correctness through the cache window and between polls** — the countdown is against an absolute target, so it stays accurate as `nowSec` advances.
  2. **Reuse** — `arrivalTime` drops into the existing `formatEta(absoluteSec, nowSec)` path that bus already uses, so rail and bus ETAs render through identical machinery. The rail mapper is the second consumer that justifies promoting `formatEta`/`formatDelay` out of `busRowMapper.ts` into a shared util.
- **Graceful fallback.** If `EVENT_TIME` fails to parse (US format, `America/New_York` — a new parse point), fall back to `nowSec + WAITING_SECONDS`. The rider still gets a usable countdown, degraded only by the cache-window offset.

This does not change the bus path — bus keeps computing its own delay because it has both halves (prediction + static schedule) and its predictions are absolute timestamps. The asymmetry is deliberate and forced by the feeds' shapes.

## Alternatives considered

**Build a rail static-GTFS join and recompute delay/ETA ourselves (mirror bus).** Rejected for v1. It reimplements what MARTA already computes authoritatively, and MARTA's operational values reflect ground truth (held trains, expressing, single-tracking) better than a static-schedule diff would. It also requires standing up rail schedule + calendar machinery we don't have and don't otherwise need for the first cut. Revisit only if we wire rail static GTFS for another reason (see below).

**Keep `WAITING_SECONDS` relative — display "N min" from the raw seconds.** Rejected. The countdown goes stale between polls and through the edge cache, and it doesn't compose with `formatEta`'s absolute-timestamp contract, forcing a second, rail-only formatting path. Anchoring to `EVENT_TIME` fixes both at the cost of one timestamp parse.

**Store both raw `waitingSeconds` and derived `arrivalTime` on the DTO.** Not an ADR-level choice — `arrivalTime` is canonical; whether we also carry the raw seconds is a field-list decision tracked in `rail.md`. Current call there: derive `arrivalTime`, drop raw `waitingSeconds`.

## Consequences

**Pros:**

- No rail static-schedule join needed for the first cut — the feed is self-sufficient for ETA and delay.
- A single source of truth (MARTA) for rail timing; no risk of our recomputation disagreeing with the agency's own displays.
- ETA freshness is correct through the cache window and between polls, matching the bus path's behavior.
- Reuses `formatEta`/`formatDelay` → unified bus/rail presentation, and triggers the "promote on second consumer" extraction of those formatters from `busRowMapper.ts`.

**Cons:**

- We inherit MARTA's errors with no independent cross-check: if their `DELAY`/`WAITING_SECONDS` is wrong, we surface it wrong. Acceptable — their figure is the one their own signage shows.
- The bus/rail asymmetry (compute vs accept) could read as inconsistency to a future maintainer. This ADR is the mitigation.
- A new failure surface: parsing `EVENT_TIME` (US format, `America/New_York`). Mitigated by the relative fallback.
- No fallback *computation* if MARTA ever stops populating `WAITING_SECONDS`/`DELAY` — we'd show scheduled-only or nothing for the missing field until we build a schedule join.

## Revisit when

- **We wire rail static GTFS for another reason** (station identity / Nearby / line metadata — open question in `rail.md`). Once a rail schedule join exists, recomputing or *cross-checking* MARTA's values becomes cheap, and we may reconsider accepting them blind.
- **Riders report rail ETAs feeling off relative to bus.** Investigate whether `EVENT_TIME` anchoring or the parse is the cause before assuming the feed is wrong.
- **MARTA changes `EVENT_TIME`'s format or stops populating the computed fields.** The anchoring and fallback assumptions here would need to be re-derived against a fresh snapshot.
