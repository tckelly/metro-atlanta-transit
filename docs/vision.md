# Vision

## The problem

MARTA bus riders ask one question more than any other: *"Is my bus actually coming?"* Today, getting that answer takes too long.

- MARTA's official site loads slowly and isn't optimized for a 10-second mobile check.
- Google Maps surfaces transit, but it's built for trip planning, not for "should I wait or walk to the backup stop?"
- The Transit app is generic — it doesn't lean into Atlanta-specific routes, cancellation patterns, or the bus-heavy reality of MARTA outside the rail spine.
- Cancellations are frequent and existing tools either hide them or surface them late.

## The user

Daily MARTA bus commuters in metro Atlanta, standing at or walking toward a stop, deciding *right now* whether to wait, walk to a backup stop, or call a ride.

Primary archetype: the rider who has 1–2 routes they take repeatedly, knows the system, and just needs a fast, honest signal about live conditions.

## What we're building

An installable PWA that answers "is my bus coming?" in under two seconds from cold open. Real-time arrivals for favorite and nearby stops, with clear, immediate indication when service is disrupted.

## Why us, not them

- **Faster** than MARTA's site and Google Maps for the quick check.
- **Honest about disruptions** — cancellations and delays are surfaced prominently, not buried.
- **Atlanta-focused** — designed around the actual MARTA bus network, not a generic transit abstraction.
- **Free, open source, no ads, no account required.**

## Non-goals (for v1)

These are deliberately *not* in scope. Saying no here is how the app stays fast and focused.

- Rail/train arrivals (bus is the differentiator; rail is well-served by Terminus).
- Multi-leg trip planning.
- Push notifications.
- User accounts, login, sync across devices.
- Native iOS/Android apps (PWA only; wrap later if there's demand).
- Cities or transit systems outside metro Atlanta.
- Languages beyond English and Spanish.
- A backend service (client-side only against MARTA's public APIs).

## Success looks like

- The dev (me) uses it daily and stops opening MARTA's site or Google Maps for bus checks.
- An Atlanta bus rider can answer "is my bus coming?" in under two seconds from a cold app open on a phone.
- Posted to r/Atlanta and r/MARTA, it gets organic word-of-mouth as the go-to for real-time bus info.

## What this doc is *not*

This is the "why" and "for whom." Specific features live in `product-requirements.md`. Architecture decisions live in `architecture.md` and `adr/`. Roadmap lives in `roadmap.md`.
