# Service alerts

Surface MARTA's published service alerts so riders see disruptions before they impact their commute. v0.0.1 ships a *cancellation-derived* "route disruption signal" at the stop level — that's a heuristic computed from `trip_updates.pb`, not the agency's own message. The GTFS-RT `alerts.pb` feed carries the real thing (planned detours, station closures, weather-driven service changes); we already decode it in `@atl-transit/gtfs` (shipped in M1) but the UI doesn't consume it yet.

This doc is a living design conversation — edit the sections below as decisions land. Load-bearing decisions spawn ADRs (linked inline from the relevant section).

## Problem

_Who's hurt by not having this, and what does the win look like? Frame it from the persona in `personas-and-jobs.md` (the bus commuter). Note relationship to the existing cancellation-based disruption signal — does this replace it, augment it, or sit alongside it?_

## Data

_What `alerts.pb` actually contains, verified against `sample-data/marta-gtfs-rt-2026-05-22/alerts.pb`: entity coverage (per-route, per-stop, per-trip, per-agency), cause/effect/severity enums, time windows, header/description text, the open question on `TranslatedString` decoding from `data-and-apis.md`._

## UX

_Where alerts surface. Candidate placements: dedicated `/alerts` page, inline banner in stop view, badge on favorites cards, settings-controlled notification (deferred — push is v2 backend territory). Key tension: signal vs noise — MARTA can publish many low-relevance alerts; what's the filter that makes only-the-ones-that-matter-to-this-rider visible?_

## Open questions

- _What's the right filter — relevance by favorite stops, relevance by routes seen in the last N days, all alerts user-toggleable?_
- _Severity model — does MARTA's GTFS-RT `severity_level` map cleanly to our visual-semantic `severity` prop (ADR-0003)?_
- _Time-windowing — do we hide alerts whose `active_period` is in the past? In the far future?_
- _Language — `TranslatedString` decoding (open question #5 in `data-and-apis.md`)._
