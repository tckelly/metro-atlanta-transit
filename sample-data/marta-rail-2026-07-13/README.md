# MARTA rail (RTT) arrivals — snapshot 2026-07-13

Phase-2 recon snapshot for the rail feature (see `docs/features/rail.md`, ADR-0010).
**Not authoritative** — a single point-in-time capture used to verify the feed's
real shape against the Phase-1 doc-derived guesses.

- **Source:** `https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/developerservices/traindata?apiKey=…`
- **Captured:** 2026-07-13, ~6:47 PM ET, via the local dev proxy (`/api/marta/rail`).
- **File:** `traindata.json` — the verbatim response body (the `apiKey` rode only
  in the request URL and is **not** present in the body; verified before commit).
- **Shape:** a **flat JSON array of 492 records**, one per predicted train arrival
  at a station, system-wide (all 4 lines, all stations).

## The one big correction: every field is a string

The Phase-1 doc guessed at types. In reality **all 13 fields are JSON strings** —
numbers, booleans, and coordinates are all stringified. Consumers must parse
(`Number(WAITING_SECONDS)`, `IS_REALTIME === 'true'`, etc.).

## Fields (confirmed against the payload)

| Field | Example | Notes |
|---|---|---|
| `STATION` | `"NORTH SPRINGS STATION"` | Present on all 492. Upper-case. |
| `LINE` | `"RED"` | Exactly `RED` \| `GOLD` \| `BLUE` \| `GREEN`. Present on all 492. |
| `DIRECTION` | `"N"` | `N` \| `S` \| `E` \| `W`. |
| `DESTINATION` | `"North Springs"` | Terminus headsign, title-case. |
| `TRAIN_ID` | `"402"` | Stable key for a train across polls. |
| `NEXT_ARR` | `"06:48:26 PM"` | Clock time, 12-hour. **US format, not ISO.** |
| `WAITING_TIME` | `"1 min"`, `"Arriving"` | Human string. **`"Arriving"` is the low-end sentinel** (not "0 min"). |
| `WAITING_SECONDS` | `"63"` | Numeric string. Observed range **0–4097**. No sentinels. Canonical ETA input. |
| `IS_REALTIME` | `"true"` | `"true"` \| `"false"` string. **278 true / 214 false** in this capture. |
| `DELAY` | `"T45S"`, `"T-7S"`, `"T0S"` | **Only on real-time records.** See below. |
| `LATITUDE` | `"33.938214"` | **Only on real-time records.** |
| `LONGITUDE` | `"-84.357252"` | **Only on real-time records.** |
| `EVENT_TIME` | `"07/13/2026 6:47:15 PM"` | Feed timestamp. **US format, not ISO.** |

## Load-bearing findings

1. **`DELAY` / `LATITUDE` / `LONGITUDE` are present iff `IS_REALTIME === "true"`.**
   All three are missing on exactly the 214 scheduled records and present on all
   278 real-time ones. So in the schema they are **optional**, and semantically
   they exist only for live trains. Consequence: **a map view is inherently
   real-time-only** — scheduled predictions carry no position.

2. **`DELAY` is a signed duration: `T<seconds>S`.** Values seen include `T45S`,
   `T0S`, and negatives like `T-7S`, `T-27S`, `T-65S`. Parse as
   `/^T(-?\d+)S$/` → seconds; positive = behind schedule, `0` = on time,
   negative = ahead. This *is* a usable severity input (contra the Phase-1
   "semantics unconfirmed" flag) — but wiring it to color is a later UX call,
   and only meaningful for real-time trains.

3. **No occupancy, no downstream-stops.** Confirms the open questions in
   `rail.md`: the feed is arrival-at-station-centric. There is no per-train
   crowding field (bus has one; rail doesn't) and no "remaining stops on this
   run." Any such UX would need a different source.

4. **Structurally identical to bus stop-detail.** Arrival-prediction-per-station
   maps cleanly onto the existing "next buses at this stop" pattern:
   `WAITING_SECONDS` → ETA, `IS_REALTIME` → live/scheduled status, `DIRECTION`
   → the disambiguator (ADR-0008), `LINE` → a color token.

## Regenerating

Requires the rail API key — **never commit it.** With the key in
`packages/web/.env.local`, run the dev server (`pnpm --filter @atl-transit/web dev`)
and fetch `http://127.0.0.1:5173/api/marta/rail`; the dev proxy injects the key
server-side. Save the body here as `traindata.json` and re-verify it contains no
`apiKey` before committing. Then hand-edit this README — keep the curated framing,
don't dump raw output.
