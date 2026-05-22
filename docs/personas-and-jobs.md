# Personas & Jobs-to-be-Done

## Primary persona: the Routine Commuter

The rider this app is designed around.

- Takes MARTA buses regularly — usually the same 1–2 routes from the same 1–2 stops.
- Knows the system. Doesn't need trip planning, route discovery, or onboarding.
- Uses a phone, one-handed, often while walking or already at the stop.
- Has been burned by a canceled or no-show bus and now distrusts schedules.
- Will check arrival info multiple times per trip: at home, walking, at the stop.

**What they care about:** speed, honesty, and a glanceable answer. Not features.

**Anchor scenario (the dev's own commute):** Virginia-Highland resident who normally takes Route 36, falls back to Route 102 (a 12-minute walk away) when 36 is canceled. The decision *"should I head to 36 or pre-commit to walking to 102?"* must be answerable in seconds.

## Secondary persona: the Occasional Rider

Worth designing *around* but not *for*. The app shouldn't actively get in their way.

- Rides MARTA buses sometimes — visiting Atlanta, car in the shop, going to an event.
- Doesn't know specific routes or stop names; relies on "what's near me right now."
- More tolerant of friction, but won't return if the first experience is rough.

The Routine Commuter's UX (geolocation + clear arrivals) covers most of what the Occasional Rider needs. We don't build separate flows for them in v1.

## Anti-personas

Explicit non-audiences — surfacing this prevents scope drift.

- **Trip planners** comparing multi-modal routes (use Google Maps).
- **Rail-primary riders** (use Terminus or MARTA's own tools).
- **Transit hobbyists** wanting maps, vehicle tracking, or analytics dashboards.
- **Riders outside metro Atlanta.**

## Jobs to be done

When the Routine Commuter pulls out their phone, they're trying to do one of these three jobs. Every v1 feature should map to one of them.

### Job 1 — "Is my bus actually coming?"

> When I'm about to leave for my stop, or already at it, I want to see live arrival times for my route — *including* buses that are cancelled, clearly marked as such, and a hint of how full they're likely to be — so I can decide whether to wait, walk to a backup stop, or call a ride.

This is the dominant job. Everything else exists to support it.

- Triggered: at home before leaving, walking to stop, standing at stop.
- Required signal: the next 2–3 *scheduled* buses on my route, each annotated with one of: live arrival ETA, "cancelled," or "no live data." The user should never wonder whether they're looking at a complete picture.
- Secondary signal (v1): bus occupancy when available — `MANY_SEATS_AVAILABLE`, `STANDING_ROOM_ONLY`, etc. MARTA publishes this on ~55% of vehicles. Display it when present; do not invent it when absent. See `data-and-apis.md` for source detail.
- **Design principle:** show the full slate of scheduled buses and label what's broken. Don't hide cancelled or missing-data buses — silent omission makes the user second-guess the app.
- Failure mode today: schedules lie when buses are cancelled or running off-pattern; cancelled trips simply *disappear* from some tools, which is worse than showing them struck-through.
- **Verified against MARTA's feeds:** cancellations are first-class (`TripUpdate.schedule_relationship = CANCELED`). No inference fallback needed for v1. Details in `data-and-apis.md`.

### Job 2 — "Is my route disrupted today?"

> When I'm planning my commute, I want to know if my route is cancelled, delayed, or running abnormally, so I can switch to a backup *before* I'm stuck waiting.

- Triggered: morning routine, before leaving the house.
- Required signal: a clear, prominent indicator of route-level cancellation or major disruption — not buried in fine print.
- Failure mode today: disruption info is hard to find or arrives only after you're already at the stop.
- **Verified against MARTA's feeds:** MARTA's alerts feed was empty at the recon snapshot. v1 will derive route-level disruption from trip-update aggregation (e.g., "Route 36 — 3 of next 5 trips cancelled") rather than from first-class service alerts. May revisit if MARTA's alerts feed turns out to publish richer data at other times. Details in `data-and-apis.md`.

### Job 3 — "What's near me right now?"

> When I'm somewhere unfamiliar (or just away from my usual stops), I want to see what stops are nearby and what's coming, so I can hop on a bus without planning a trip.

- Triggered: away from routine, end of an event, unfamiliar neighborhood.
- Required signal: closest stops sorted by distance, with live arrivals visible without an extra tap.
- Lower-frequency than Jobs 1 & 2, but the entry point for the Occasional Rider.

## The journey today (what we're replacing)

The user currently does some version of:

1. Open MARTA's site or Google Maps.
2. Search or navigate to the stop/route.
3. Wait for the page to load.
4. Squint at schedule data and try to infer whether it's live or static.
5. Make the decision with low confidence.

Five steps, slow, and the last step is guesswork. Our bar is: **two seconds, two taps, real data.**

## What this doc is *not*

This is *who* and *what they're trying to do*. The specific features that satisfy these jobs live in `product-requirements.md`.
