# Data & APIs

What MARTA's public feeds actually publish, and what that means for the app. Findings are from a live snapshot at **2026-05-22T16:54:44 UTC** (Friday midday Atlanta time). Bus volumes vary by time of day; numbers below are illustrative of a busy weekday window.

The raw `.pb` files this analysis is based on are committed under `sample-data/marta-gtfs-rt-2026-05-22/`. To regenerate or sample at a different time, see `sample-data/README.md`.

## Sources

| Source | URL | Format | Auth |
|---|---|---|---|
| GTFS-RT Vehicle Positions | `https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb` | Protocol Buffers | None |
| GTFS-RT Trip Updates | `https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/tripupdate/tripupdates.pb` | Protocol Buffers | None |
| GTFS-RT Service Alerts | `https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/alert/alerts.pb` | Protocol Buffers | None |
| GTFS Static (schedule, stops, routes) | `https://itsmarta.com/google_transit_feed/google_transit.zip` | CSV in ZIP | None |

All three GTFS-RT feeds share the same `gtfs_realtime_version: 2.0` and a unified `header.timestamp` so they can be treated as a synchronized snapshot.

## Headline findings

### 1. Cancellations are first-class — use them directly.

`trip_updates.pb` publishes `TripUpdate.trip.schedule_relationship = CANCELED` explicitly. In the recon snapshot, **45 of 388 active trips (~12%) were cancelled** — a real, not theoretical, signal. Cancelled trips also mark every constituent stop as `SKIPPED`, but the trip-level flag is sufficient and cleaner to consume.

**Implication for Job 1:** we don't need inference fallbacks. A trip in `trip_updates` with `schedule_relationship = CANCELED` is authoritative.

### 2. Live arrival predictions exist for ~86% of stop-time-updates on scheduled trips.

For `SCHEDULED` trips, each `stop_time_update` contains:

- `arrival.time` — predicted Unix timestamp of arrival
- `arrival.scheduledTime` — the original scheduled timestamp
- `departure.{time, scheduledTime}` — same shape for departure
- `stop_id`, `stop_sequence` — joins back to static GTFS

This means we can compute both "ETA" (`time - now`) and "how delayed" (`time - scheduledTime`) for every upcoming stop on every active trip. In the snapshot, 15,485 of 17,918 stop-time-updates carried arrival predictions.

**Implication for Job 1:** good ETA data is available. For the missing ~14%, we fall back to scheduled time and label as "no live data."

### 3. The alerts feed is currently empty.

`alerts.pb` returned a valid `FeedMessage` with header only — **0 alert entities**. **Re-sampled 2026-07-13** (`sample-data/marta-gtfs-rt-2026-07-13/`), on a different weekday and time: still **0 entities**, and MARTA's own alerts page (`itsmarta.com/ride/alerts`) also showed 0 at that moment. Two empty samples ~7 weeks apart confirm the feed is empty during *normal operations*; they don't prove it's *never* populated (MARTA near-certainly publishes during real disruptions). At the moment we cannot rely on it for service disruption messaging.

**Implication for Job 2:** v1 should derive route-level disruption from `trip_updates`, not from alerts. Example signal: "Route 36 — 3 of next 5 scheduled trips cancelled." If the alerts feed turns out to publish meaningful data at other times (see open questions), we layer it in as additional context.

### 4. Vehicle Positions includes occupancy — and we're using it in v1.

198 active vehicles in the snapshot. Every entity carries:

- `trip` (tripId, routeId, startDate)
- `position` (lat, lng, bearing, speed)
- `vehicle` (id, label)
- `timestamp`

Present on a partial subset:

- `occupancyStatus` (~55% of vehicles) — e.g., `MANY_SEATS_AVAILABLE`, `FEW_SEATS_AVAILABLE`, `STANDING_ROOM_ONLY`
- `occupancyPercentage` (~33%)

**Implication:** crowding info is available essentially for free on a subset of buses. **In v1 we surface `occupancyStatus` when present** and omit it when absent — never invent or interpolate. It's a secondary signal on Job 1 ("is my bus coming, and will I get a seat?"). `occupancyPercentage` is left for later; the categorical status is more glanceable.

### 5. The "string quirk" is a `TranslatedString` envelope — decodable, but currently empty.

`stopTimeProperties.stopHeadsign` and `tripProperties.tripShortName` arrive as raw bytes when read with the standard `gtfs-realtime-bindings` library, because MARTA publishes them as `TranslatedString` sub-messages while the standard GTFS-RT proto declares them as plain `string`. When decoded against the `TranslatedString` shape, the payload in this snapshot is:

```json
{ "translation": [ { "text": "", "language": "en" } ] }
```

So even with a custom decoder there's no useful content in these fields *today* — MARTA sends the envelope but populates empty text.

**v1 approach:** ignore these realtime fields. Use static GTFS (`trips.txt` → `trip_headsign`) for human-readable destination names. Static GTFS is more reliable and always populated.

**v2 nice-to-have:** add a small `TranslatedString` decoder so that if/when MARTA starts publishing real translated content (e.g., Spanish per-stop headsigns), we can surface it without a code change.

`tripProperties.tripHeadsign` (a different field) decodes cleanly as a plain string but its content mirrors the route ID (`"116"` for one sample) rather than a destination name. Static GTFS remains the better source.

## Data shape we'll consume (v1)

For each stop the user is viewing, the app needs to produce a list of upcoming buses. The pipeline:

1. **Static GTFS** gives us: which trips serve this stop, scheduled time of each, route metadata, headsigns, stop locations.
2. **`trip_updates`** gives us, per trip: real-time predicted arrival at this stop, or `CANCELED`.
3. **`vehicle_positions`** gives us, per trip in progress: where the bus currently is, plus occupancy when reported.

For each upcoming bus shown to the user:

```
{
  routeId: "36",
  routeShortName: "36",            // from static GTFS
  headsign: "Decatur Station",     // from static GTFS
  tripId: "...",
  scheduledTime: 1779468116,       // unix seconds
  status: "live" | "cancelled" | "no_live_data",
  predictedTime?: 1779467993,      // present when status === "live"
  delaySec?: -123,                 // predictedTime - scheduledTime
  vehiclePosition?: { lat, lng },  // present when in progress
  occupancy?: "MANY_SEATS_AVAILABLE" | ...  // present on ~55% of in-progress buses
}
```

The `status` field is the load-bearing one for the "show all buses, label what's broken" UX principle from `personas-and-jobs.md`. The `occupancy` field is a v1 nice-to-have on Job 1.

## Polling strategy

- `trip_updates` and `vehicle_positions`: **poll every 30s** while a stop view is foregrounded. The feed's own timestamp updates roughly every 30s, so faster polling buys nothing.
- `service_alerts`: **poll every 5 min** — alerts change slowly.
- Pause polling on tab blur and resume on focus; never poll when the PWA is backgrounded.
- All three feeds are small enough to fetch in full each poll (`trip_updates` is the largest at ~900 KB). No need for delta/incremental even though GTFS-RT supports it — MARTA's feed uses `incrementality = FULL_DATASET` anyway.

## Static GTFS

Spec URL: `https://itsmarta.com/google_transit_feed/google_transit.zip`. Not yet downloaded and inspected — assumed standard GTFS contents (`stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, etc.). To be verified during the first build pipeline pass.

### Storage approach — v1: build-time preprocessing

Static GTFS is too large for raw localStorage (`stop_times.txt` alone can be tens of MB), and seeding IndexedDB on first run is a poor first-impression experience.

**v1 approach:** download the static GTFS during the Vite build, transform it into a set of trimmed JSON files keyed by what the app actually needs, and bundle them with the app:

- `stops.json` — `{ stopId, name, lat, lng, routeIds: [...] }` (one entry per stop; trimmed to whatever fields the UI uses)
- `routes.json` — `{ routeId, shortName, longName, color }`
- `trips-by-stop.json` or similar — the schedule join needed by the trip-updates pipeline

The build pulls fresh static GTFS at deploy time. Data goes stale until the next deploy, but MARTA updates static GTFS weekly/monthly, so a scheduled redeploy (e.g., once a week via Vercel cron / GitHub Actions) keeps things current. No backend, no IndexedDB, no first-run download.

### Storage approach — v2: a thin backend

Once we want fresher static data, server-side joins, or any logic that doesn't belong in the client (rate-limited proxying, historical reliability tracking, push notifications), the natural next step is a thin backend — likely Vercel serverless functions. This is an explicit v2 path, not a v1 workaround. See `vision.md` non-goals.

## Open questions / future verification

1. **Is the alerts feed ever populated?** Sample at different times of day, and during known disruptions (planned maintenance, weather events). Add follow-up snapshots under `sample-data/` if we find populated data.
2. **Static GTFS contents and size.** Download once, confirm the file list and sizes, finalize the build-time preprocessing schema.
3. **Feed freshness behavior.** The snapshot's `header.timestamp` matched across all three feeds — confirm that's MARTA's normal behavior and not a coincidence by sampling more.
4. **Bus occupancy stability.** ~55% coverage in the 2026-05-22 snapshot. **Re-sampled 2026-07-13: coverage was 100%** (`occupancyStatus` and `occupancyPercentage` on all 197 vehicles), with a realistic spread (`EMPTY`/`MANY_SEATS_AVAILABLE` dominant on a light midday load). Either a genuine telemetry improvement or time-of-day variance — two samples can't distinguish. Net: a positive signal for the v1 occupancy feature. Worth continued sampling to confirm the higher coverage holds.
5. **Do `TranslatedString` fields ever carry real content?** Today MARTA publishes the envelope but the inner text is empty (see finding #5). If MARTA ever populates these — likely candidates: dynamic detour headsigns, special-service destinations, Spanish translations — they'd become genuinely useful and we'd want a custom decoder. Re-check on future snapshots; the trigger to act is non-empty text in any `TranslatedString` field.

## What this means for product requirements

- Job 1 ("is my bus coming?") is **fully buildable** against real data. Cancellations, predicted arrival, scheduled fallback, and occupancy are all available.
- Job 2 ("is my route disrupted?") is **buildable but degraded** in v1: it will surface route-level cancellation rates derived from `trip_updates`, not first-class service alerts. Acceptable for v1; revisit if alerts feed ever provides richer data.
- Job 3 (nearby stops) is **gated on static GTFS preprocessing**, which is a build pipeline concern — not a runtime data concern. As long as static GTFS contains the expected `stops.txt`, it's straightforward.

Carry these into `product-requirements.md` as constraints.
