# MARTA GTFS-RT Snapshot — 2026-07-13

Snapshot captured around **2026-07-13T18:09 UTC** (Monday, ~2:09 PM Atlanta time — a weekday-afternoon window).

Captured primarily to re-sample the **service alerts** feed for the alerts feature design (see `docs/features/alerts.md`) and to check whether the feed is ever populated (open question #1 in `docs/data-and-apis.md`). Headline: **still empty.**

Feed generation is *not* perfectly atomic this time: `vp.pb` and `tu.pb` share `header.timestamp` = `18:08:58`, but `al.pb` is `18:09:28` — 30 s later. The 2026-05-22 snapshot had all three matching. So "all feeds share one timestamp" holds within the realtime pair but is not guaranteed across the alerts feed.

## Files

| File | Size | What it is |
|---|---|---|
| `vp.pb` | 15.5 KB | Vehicle positions — live lat/lng for active buses |
| `tu.pb` | 807 KB | Trip updates — predicted arrivals and cancellation flags |
| `al.pb` | 15 B | Service alerts — header only, **empty again** |

## At a glance

- **197 active vehicles** in the system
- **386 active trips** being tracked
- **77 trips (~20%) cancelled** at this moment (up from ~12% in the May snapshot)
- **69 distinct routes** appearing in trip updates
- **16,628 stop-time updates**, ~81% with live arrival predictions
- **0 service alerts**
- **Occupancy now on 100% of vehicles** (was ~55% in May) — see note below

## Feed: `al.pb` (Service Alerts) — the reason for this snapshot

```json
{
  "header": {
    "gtfsRealtimeVersion": "2.0",
    "incrementality": "FULL_DATASET",
    "timestamp": "1783966168"
  },
  "entity": []
}
```

**Second empty sample, ~7 weeks after the first.** The 2026-05-22 snapshot was empty; so is this one, on a different day of the week and time of day. Two data points don't prove the feed is *never* populated — MARTA almost certainly publishes alerts during actual disruptions (weather, planned detours, station work) — but they do confirm the feed is empty during **normal operations**, which is most of the time.

**Cross-checked against MARTA's public alerts page** (`https://itsmarta.com/ride/alerts`) at capture time: it also showed **0 alerts**, organized into four categories — *Stations and Stops*, *Rail*, *Bus*, and *General*. The website and the GTFS-RT feed agreeing (both empty) is a good sign that `alerts.pb` faithfully mirrors "no active alerts" rather than being a permanently-broken/unpopulated feed. Caveat: that page is client-rendered and the fetch hit an "offline" fallback, so treat the cross-check as suggestive, not definitive — worth repeating the comparison *while alerts are live* to confirm the feed mirrors the website during a real disruption.

**Consequence for the alerts feature:** we have **no real alert entities to design or test against**. Building UI now means building against synthetic data we invented, which is exactly what `sample-data/` exists to avoid. The gating recon for this feature is *catching the feed while it's populated* — snapshot again during a known disruption (a snow/ice event, a planned rail-station closure, a big detour) and freeze that payload here. See `docs/features/alerts.md` → Data.

## Feed: `vp.pb` (Vehicle Positions)

197 entities. Field population:

| Field | Populated |
|---|---|
| `vehicle.trip` (tripId, routeId, startDate) | 197 / 197 |
| `vehicle.position` (lat, lng, bearing, speed) | 197 / 197 |
| `vehicle.timestamp` | 197 / 197 |
| `vehicle.vehicle` (id, label) | 197 / 197 |
| `vehicle.occupancyStatus` | **197 / 197 (100%)** |
| `vehicle.occupancyPercentage` | **197 / 197 (100%)** |

### Occupancy coverage jumped

In May, `occupancyStatus` was on ~55% of vehicles and `occupancyPercentage` on ~33%. In this snapshot **both are on every vehicle.** Observed `occupancyStatus` distribution:

| Value | Count |
|---|---|
| `EMPTY` | 98 |
| `MANY_SEATS_AVAILABLE` | 93 |
| `STANDING_ROOM_ONLY` | 2 |
| `FULL` | 2 |
| `FEW_SEATS_AVAILABLE` | 1 |
| `CRUSHED_STANDING_ROOM_ONLY` | 1 |

This is either a genuine improvement in MARTA's telemetry or time-of-day variance — one more sample can't distinguish. It's a positive signal for the v1 occupancy feature (finding #4 in `data-and-apis.md` flagged ~55% coverage as a re-sample candidate; this is the re-sample, and coverage is up). The `EMPTY`-heavy distribution is consistent with a light midday load.

Field shapes are identical to the 2026-05-22 snapshot — see that folder's README for a fully-annotated sample entity.

## Feed: `tu.pb` (Trip Updates)

386 entities. `schedule_relationship` distribution:

| Value | Count |
|---|---|
| `SCHEDULED` | 309 |
| `CANCELED` | 77 |

~20% of active trips cancelled at this moment, versus ~12% in the May snapshot — a reminder that the cancellation-derived disruption signal (v0.0.1's Job 2) is load-bearing and varies meaningfully by day.

69 unique `route_id` values appear. 16,628 stop-time updates, ~81% (13,450) carrying live `arrival` predictions — comparable to May's 86%. Trip-update and stop-time-update field shapes are unchanged from the 2026-05-22 snapshot; see that README for annotated samples and the `TranslatedString` quirk writeup.
