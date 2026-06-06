# Real-time rail

Add real-time MARTA heavy rail data so the app covers riders whose commute involves at least one rail leg. v0.0.1 is bus-only by design (see `vision.md` non-goals) — rail was originally Tier 3 / speculative in `roadmap.md` because the spec questioned scope-vs-Terminus and the API shape was unknown. This doc reopens that question for v0.0.x and tracks what we learn as we get hands-on with the API.

This doc is a living design conversation — edit the sections below as decisions land. Load-bearing decisions spawn ADRs (linked inline from the relevant section).

## Problem

_Who benefits, and how much? Atlanta's rail network is 4 lines centered downtown — a meaningful slice of commuters use it as part of a multi-modal trip. Frame against the existing personas; possibly introduce a second persona if rail riders have meaningfully different jobs-to-be-done._

## Data

_MARTA's rail API is separate from the public GTFS-RT bus feeds: requires registering on the developer portal for a free key, returns JSON (not protobuf), different shape from `vehicle_positions.pb` / `trip_updates.pb`. Capture API specifics here once registration completes — endpoints, auth model, data fields, update cadence, rate limits, terms of use. Note any need for a backend proxy (key shouldn't live in the client; CORS likely also a factor — see ADR-0001's successor)._

## UX

_How rail integrates with bus. Options: unified surface (one stop list / favorites mixed), separate tab/section, separate sub-app. Stop-detail equivalent for stations. "Next train" formatting differs from "next bus" (frequency vs schedule). Map view becomes more tempting for rail than it is for bus._

## Open questions

- _Is the API shape rich enough to support our existing UX patterns (status classification, downstream stops, occupancy) or do we need new ones?_
- _Scope vs Terminus app — do we ship rail because we can, or because we add something Terminus doesn't?_
- _Auth + key storage — backend proxy is almost certainly required; how does that compose with the bus backend (ADR-0001 successor)?_
- _Favorites model — do rail stations share the favorites store with bus stops, or live separately?_
