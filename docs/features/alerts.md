# Service alerts

Surface MARTA's published service alerts so riders see disruptions before they impact their commute. v0.0.1 ships a *cancellation-derived* "route disruption signal" at the stop level — that's a heuristic computed from `trip_updates.pb`, not the agency's own message. The GTFS-RT `alerts.pb` feed carries the real thing (planned detours, station closures, weather-driven service changes); we already decode it in `@atl-transit/gtfs` (shipped in M1) but the UI doesn't consume it yet.

This doc is a living design conversation — edit the sections below as decisions land. Load-bearing decisions spawn ADRs (linked inline from the relevant section).

**Status: design open, blocked on real data.** As of the two snapshots we hold (2026-05-22, 2026-07-13) the `alerts.pb` feed is *empty* during normal operations. We can't design or test a great UX against zero alert entities. The gating task is a **recon-during-disruption**: capture a populated `alerts.pb` (weather event, planned station closure, big detour) into `sample-data/`, then derive fixtures from it. Until then this doc records what we know and what we've decided *not* to do yet. See Recon log.

## Problem

The rider's question is "is something going to mess up my trip that I can't see from arrivals alone?" A cancelled trip shows up in our existing Job-2 signal, but a *planned detour* ("Route 110 is not serving Peachtree & 10th this week, use the temporary stop at …"), a *station closure*, or a *weather-driven system-wide change* does not — those live only in `alerts.pb` (and on MARTA's website). Those are exactly the disruptions a rider most wants advance warning of, because they change *where you stand*, not just *when the bus comes*.

Relationship to the existing cancellation-derived signal: **alerts augment, they don't replace.** The two are different channels — cancellations are a computed statistical signal ("3 of 5 recent trips cancelled"); alerts are the agency's own authored message about a specific planned/known event. They can co-occur (a weather alert *and* a spike in cancellations) and should reinforce, not compete, in the UI.

**The maintainer's stance (to resolve into a decision):** service alerts as typically shipped are bad UX — poorly-written operator text, buried in a modal nobody opens, ignored. Two honest options:

- **Bare-bones:** just give the rider a reliable, easy way to see the alerts relevant to *their* routes/stops. Low ambition, low risk, honest about being a passthrough of MARTA's text. Ships fast.
- **Great-UX:** surface the *right* alert at the *right* moment (e.g. an inline banner on a stop the alert names, on a favorited route), suppress the noise, and make the agency text glanceable. Higher ambition; only worth it if the feed carries enough structured, relevant data to filter on — which we can't confirm until we see populated data.

Recommendation: don't pick yet. The choice is **downstream of the data** — if populated alerts turn out to be sparse, well-scoped (informed-entity actually names routes/stops), and low-volume, great-UX is cheap and worth it; if they're high-volume agency-wide noise with vague text, bare-bones is the honest ceiling. Decide after the recon-during-disruption snapshot.

## Data

**Feed:** GTFS-RT Service Alerts, `https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/alert/alerts.pb`, Protocol Buffers, no auth. Standard GTFS-RT `FeedMessage` of `Alert` entities.

**Decoder already exists.** `packages/gtfs/src/alerts.ts` (`decodeAlerts`) shipped in M1 and validates output with `AlertsFeedSchema` (`packages/gtfs/src/types.ts`). It currently extracts, per alert:

| Field | Source | Notes |
|---|---|---|
| `id` | `entity.id` | required |
| `cause` | `Alert.cause` | enum, optional — `WEATHER`, `MAINTENANCE`, `CONSTRUCTION`, `ACCIDENT`, `POLICE_ACTIVITY`, … (`AlertCauseSchema`) |
| `effect` | `Alert.effect` | enum, optional — `DETOUR`, `NO_SERVICE`, `REDUCED_SERVICE`, `SIGNIFICANT_DELAYS`, `MODIFIED_SERVICE`, … (`AlertEffectSchema`) |
| `headerText` | `Alert.header_text` | first English `TranslatedString`, else `undefined` |
| `descriptionText` | `Alert.description_text` | first English `TranslatedString`, else `undefined` |
| `affectedRouteIds` | `informed_entity[].route_id` | joins to static GTFS routes |
| `affectedStopIds` | `informed_entity[].stop_id` | joins to static GTFS stops |
| `activePeriods` | `Alert.active_period[]` | `{ start?, end? }` unix seconds |

**Gaps in the current decoder** (add when we consume alerts, ideally against real data):
- **`severity_level`** is *not* captured — relevant to the ADR-0003 `severity` visual-prop mapping open question below.
- **`url`** (`Alert.url` TranslatedString, "more info" link) is not captured.
- **Agency-wide selectors** (`informed_entity` with only `agency_id`, no route/stop) are silently dropped by the current extract loop — a system-wide weather alert could therefore decode to an alert with *empty* `affectedRouteIds`/`affectedStopIds`. That's a real case (MARTA's website has a "General" category) and needs handling.

**What the feed actually contains today: nothing.** Both snapshots return a valid header and **zero entities**:

- `sample-data/marta-gtfs-rt-2026-05-22/al.pb` — 0 entities (Friday midday)
- `sample-data/marta-gtfs-rt-2026-07-13/al.pb` — 0 entities (Monday afternoon)

Cross-checked 2026-07-13 against MARTA's public alerts page (`https://itsmarta.com/ride/alerts`): it also showed 0 alerts, in four categories — **Stations and Stops, Rail, Bus, General**. Website and feed agreeing (both empty) suggests the feed mirrors reality rather than being broken — but this is unconfirmed until we see them agree *while alerts are live*.

**`TranslatedString` quirk applies here too.** Header/description text arrive as `TranslatedString` envelopes; `decodeAlerts` already unwraps the first English translation. In every field we've seen so far MARTA populates the envelope with empty text (see `data-and-apis.md` finding #5 and open question #5) — but we've never seen a *populated* alert, so we don't yet know whether alert text is real or empty-enveloped like the headsign fields. **This is the single most important thing the recon-during-disruption snapshot has to answer.**

The four website categories map cleanly onto GTFS-RT `informed_entity` selectors: *Stations and Stops* → `stop_id`, *Bus/Rail* → `route_id` (+ `route_type`), *General* → agency-wide. Good sign the structured data, when present, will be scoped enough to filter on.

## UX

_Where alerts surface. To be decided after the data recon — see the bare-bones vs great-UX fork in Problem. Candidate placements to evaluate against real data:_

- **Inline banner in stop view** — highest relevance: the alert names a stop the rider is looking at.
- **Badge / banner on favorites cards** — alert touches a favorited route or stop.
- **Dedicated `/alerts` page** — the "show me everything" fallback; also the honest bare-bones home.
- **Notification** — deferred; push is v2 backend territory (see roadmap Tier 1).

Key tension: **signal vs noise.** MARTA can publish many low-relevance alerts; the filter that makes only-the-ones-that-matter-to-*this*-rider visible is the whole game. We can't tune that filter without seeing real alert volume and scoping.

## Recon log

- **2026-05-22** — first snapshot. `alerts.pb` empty (0 entities). Recorded in `data-and-apis.md` finding #3.
- **2026-07-13** — re-sampled ~7 weeks later, different weekday/time. Still 0 entities. MARTA's website alerts page also showed 0 (categories: Stations and Stops / Rail / Bus / General). Snapshot + writeup in `sample-data/marta-gtfs-rt-2026-07-13/`.
- **TODO — recon-during-disruption.** Capture `alerts.pb` while alerts are live (weather event, planned station closure, published detour) and freeze it here. This is the gating input for the whole feature: it tells us whether alert text is real or empty-enveloped, what `informed_entity` scoping looks like in practice, alert volume, and whether `severity_level` is populated. Watch `itsmarta.com/ride/alerts`; when it's non-empty, snapshot immediately (feeds are `FULL_DATASET`, so a single fetch is a complete capture).

## Open questions

- _What's the right filter — relevance by favorite stops, relevance by routes seen in the last N days, all alerts user-toggleable?_
- _Severity model — does MARTA's GTFS-RT `severity_level` map cleanly to our visual-semantic `severity` prop (ADR-0003)? (Decoder doesn't capture it yet — add during the consume pass.)_
- _Time-windowing — do we hide alerts whose `active_period` is in the past? In the far future? Show "starts in 2 days" for upcoming planned work?_
- _Agency-wide alerts — how do we present a "General" alert with no route/stop scoping? (Current decoder drops these; needs handling.)_
- _Language — `TranslatedString` decoding (open question #5 in `data-and-apis.md`). Is alert text real, or empty-enveloped like the headsign fields?_
- _Bare-bones vs great-UX — the fork in Problem. Resolve after recon-during-disruption._
