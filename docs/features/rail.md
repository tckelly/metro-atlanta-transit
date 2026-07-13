# Real-time rail

Add real-time MARTA heavy rail data so the app covers riders whose commute involves at least one rail leg. v0.0.1 is bus-only by design (see `vision.md` non-goals) — rail was originally Tier 3 / speculative in `roadmap.md` because the spec questioned scope-vs-Terminus and the API shape was unknown. This doc reopens that question for v0.0.x and tracks what we learn as we get hands-on with the API.

This doc is a living design conversation — edit the sections below as decisions land. Load-bearing decisions spawn ADRs (linked inline from the relevant section).

**Status: committed to v0.0.2, design in progress, gated on the API key.** The API *shape* is now reconned from MARTA's public developer docs (Data section below). What's left before we can build: (1) register for the free rail API key (a browser form — see below), (2) Phase-2 recon — hit the live endpoint once and snapshot a real JSON response into `sample-data/` to verify the documented shape and learn the fields the docs don't fully specify, and (3) an ADR for the secret-injecting rail proxy (see Data → Architecture). Until the key lands, the UX decisions are informed but not final.

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

*Inference flags:* `IS_REALTIME` and `DELAY` semantics are guesses from the field names — Phase-2 recon must confirm the exact types/values before we wire them to status or severity. Do not build status classification on them until verified against a real payload.

**Mapping onto existing patterns.** The response is arrival-prediction-shaped *per station*, which is structurally the same as our bus stop-detail ("next buses at this stop"). So `IS_REALTIME` → status classification, `WAITING_SECONDS` → ETA formatting, `DIRECTION` → the disambiguator pattern (ADR-0008), and `LINE` → a color token all reuse machinery we already have. This is the strongest argument that rail is an *extension* of the current app, not a parallel one.

### Architecture — a secret-injecting proxy (needs a new ADR)

The query-param key **cannot live in the client** — anything in the bundle or a client request is publicly visible, which would leak the key. So rail requires a server-side proxy that holds the key (env var / `.env.local`, gitignored per CLAUDE.md security) and appends it to the upstream call. CORS and the non-standard port (`:18096`) almost certainly block a direct browser fetch too, exactly as they did for the bus feeds (ADR-0005) — but the key-exposure reason alone is decisive.

We already run a minimal backend proxy for the bus feeds (**ADR-0005**), which partially superseded the original "no backend" decision (**ADR-0001**). But ADR-0005 was deliberately scoped to **public, no-auth, hard-coded** upstream URLs with **no secrets and no user input** — its whole risk argument ("open relay for two specific upstream URLs") rests on there being nothing to protect. A rail proxy that injects a secret key is a *different* security posture: it must never echo the key, and a naive passthrough that forwards client query params could leak or let callers override it. That's a load-bearing change to the proxy's threat model, so **rail warrants its own ADR (Proposed)** rather than quietly extending ADR-0005. The rail endpoint returns JSON, so — unlike the byte-passthrough bus proxy — the function *can* cheaply decode/validate/trim server-side (Zod), and could filter to a requested station to shrink the payload, mirroring the "server-side trip-update filtering" candidate in `roadmap.md`.

## UX

Informed by the recon; final calls wait on the live data and dogfooding.

**Leaning: unified surface, not a separate sub-app.** Because the rail arrival shape maps onto the bus stop-detail pattern, a **station-detail view** that mirrors stop-detail is the natural home — "next trains at Five Points" reads like "next buses at this stop." Candidate integration points:

- **Station detail** ≈ stop detail: grouped by `LINE` + `DIRECTION`, each row an upcoming train with ETA from `WAITING_SECONDS` and a live/scheduled badge from `IS_REALTIME`.
- **Favorites** — do rail stations share the favorites store with bus stops, or live separately? *Open question below.* Unified is friendlier for multi-modal commuters; separate is simpler to model.
- **Nearby** — stations could appear in the nearby list alongside stops (they have lat/lng in static GTFS), with a mode indicator. Only if it doesn't muddy the glanceable bus-first experience.

**Rail-specific UX tensions:**
- **Frequency vs schedule.** Rail riders often don't consult a schedule — they show up and wait. "Next train: 4 min" is the whole answer; a scheduled timetable matters less than for bus.
- **Line color.** Rail leans hard on line color (Red/Gold/Blue/Green) as identity. Must come through the semantic-token system (CLAUDE.md brand rule), not raw Tailwind palette — a `line` → token map, like bus `severity` → token.
- **Map view.** `LATITUDE`/`LONGITUDE` per train makes a map genuinely useful for rail (watching your train approach Five Points), where the roadmap has held the line on bus maps for bundle-weight reasons. Rail may be where a map first earns its keep — but that's a v2-scale decision, out of scope for the first rail cut.

## Recon log

- **2026-07-13** — Phase-1 recon from MARTA's public developer docs: endpoint, query-param auth, JSON format, and the field list above. No live call (no key yet). Registration page and process documented (Getting the key).
- **TODO — Phase-2 recon (needs key).** Once the key arrives: fetch the live endpoint once, snapshot the raw JSON response into `sample-data/marta-rail-YYYY-MM-DD/` (parallel to the GTFS-RT snapshots — a new snapshot family since this isn't protobuf), and write the curated findings README. This verifies the documented shape, pins down `IS_REALTIME`/`DELAY` semantics and enum values, reveals fields the docs omit, and gives us real fixtures to build the schema and mappers against (per CLAUDE.md "prefer real fixtures").

## Open questions

- _Is the API shape rich enough to support our existing UX patterns (status classification, downstream stops, occupancy) or do we need new ones?_ Recon says arrivals + status + position are covered; **no per-train occupancy** field appears (bus has it, rail apparently doesn't), and there's **no obvious "downstream stops on this train's run"** — the feed is arrival-at-station-centric. Confirm in Phase 2.
- _Scope vs Terminus — do we ship rail because we can, or because we add something Terminus doesn't?_ Provisional answer in Problem: ship it to be viable for multi-modal commuters, keep scope tight, don't try to out-rail anyone.
- _Auth + key storage — backend proxy is required; how does it compose with the bus backend?_ Answered in Architecture: extends the ADR-0005 proxy but with a new secret-injecting threat model ⇒ **new ADR (Proposed)**.
- _Favorites model — do rail stations share the favorites store with bus stops, or live separately?_ Still open; leaning unified for the multi-modal rider, pending the favorites data model review.
- _Do we need MARTA static GTFS rail data too_ (station locations, line metadata, transfer relationships) to complement the realtime arrivals — or does the realtime feed carry enough? MARTA's static GTFS includes rail; check whether we need `route_type`-filtered rail stations from it for Nearby/station identity.
