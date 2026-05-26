# ADR-0007: No analytics in v1

**Status:** Accepted
**Date:** 2026-05-26

## Context

The roadmap (M6 launch prep) explicitly lists "Privacy: no analytics by default in v1 … Decision documented." This ADR is that documentation.

At v0.0.1 the app is fully client-side except for the thin realtime proxy (ADR-0005) and the static-GTFS query backend (ADR-0006). There are no user accounts, no server-side per-user state, no cross-device sync, no notifications. The only data we hold *about* the user is what their own browser stores in localStorage (favorites, language preference, clock-format preference).

Most analytics tooling that we'd plausibly drop in — Google Analytics, Mixpanel, Amplitude, even the more privacy-conscious options like Plausible or PostHog — has at minimum the following effects:

- Adds a script (typically 5–15 KB gzipped) to the initial bundle, expanding the LCP-critical-path JS we just spent time shrinking.
- Issues at least one outbound HTTP request per session (`/api/event`, `/collect`, etc.), and often one per pageview or interaction. On cellular this is measurable bandwidth.
- Stores some identifier (cookie, localStorage hash, or fingerprint-derived) to correlate events into sessions. Even when called "anonymous," this is meaningful per-user data being held by a third party.
- Adds an entry to our security threat model — a third-party JS context that runs on every page load.
- Adds a maintenance footprint: dashboard configuration, event-naming conventions, occasional vendor-side incidents.

The honest counter-argument is that we currently launch *blind*: we will not know how many people open the app, which features they use, which routes they visit, where they drop off, or whether the app loads fast enough in real-world conditions. We commit to gathering that information through other means (dogfood, Reddit feedback, manual session observation, Lighthouse and real-device perf checks) rather than instrumenting client-side.

## Decision

**No analytics, telemetry, error-tracking, or session-replay tooling ships in v0.0.1.** Specifically:

- No Google Analytics, Plausible, Mixpanel, Amplitude, Heap, PostHog, or equivalent.
- No Sentry, Bugsnag, Rollbar, or equivalent client error-tracking. (Errors are caught by our route-level boundaries and logged to `console.error`; debugging happens via DevTools when issues are reported.)
- No FullStory, LogRocket, Hotjar, or session-replay.
- No A/B-testing platforms.

The runtime networking stays limited to what `architecture.md` and the ADRs describe: MARTA realtime via our edge proxy, static GTFS via the `/api/gtfs/*` functions, and the PWA assets themselves.

## Alternatives considered

**Plausible (or a similar privacy-respecting analytics platform).** A real candidate. Plausible is open-source, doesn't use cookies, doesn't store personal data, and is GDPR-exempt for the scope we'd use it at. Page-level usage data ("how many people opened `/stop/:stopId` this week") would help us prioritize v2 features against real signal. We're declining for v1 because (a) at launch scale we expect to learn more from direct feedback than from aggregate counts, (b) any external analytics adds a request per session to the bandwidth profile we're trying to keep minimal, and (c) "this app doesn't track you" is a meaningful product trait we'd rather not give up before we have evidence we need to. Plausible (or equivalent) is the most likely candidate if we revisit.

**Server-side analytics from our own backend.** We could log a request ID + URL + timestamp on every `/api/*` call we already serve, building a usage picture without adding any client-side code. Rejected for v1 because we don't have a place to store the logs without standing up a real data store — and the moment we do that, this stops being a small project. Worth revisiting if we end up with persistent backend state for another reason (push notifications, favorites sync), at which point a usage log is incidental.

**Sentry / client error tracking only.** Tempting because errors-in-production are a real blind spot. Rejected for v1 because (a) Sentry's script is sizable and runs on every page, (b) it captures more than we'd want by default (URLs, stack traces with file paths, sometimes form values), and (c) our error boundaries already produce useful local debug info via `console.error`. The right time to add error tracking is when the volume of "it crashed" reports from users exceeds what we can reproduce manually. Until then, the cost outweighs the benefit.

**Web Vitals reporting (RUM via web-vitals.js → our own endpoint).** Lighthouse-style metrics from real devices instead of simulated ones. Rejected for v1 to keep the launch shape clean, but it's the most defensible addition we'd consider early — it's tiny, self-hosted, and directly informs the performance trade-offs we're already making (LCP, FCP, INP). Likely the first thing we'd add if we want real measurement rather than aggregate counts.

## Consequences

**Pros:**

- "Atlanta Transit does not track you" is a true statement we can put in the privacy section of the README and in Settings.
- No additional third-party scripts, network requests, or threat-model entries.
- No bandwidth cost beyond the app's own functioning.
- No vendor dashboards to log into, no event taxonomy to maintain, no PII-leakage incidents to worry about.

**Cons:**

- We launch without quantitative usage data. Decisions about which features to expand, which to deprecate, and how badly the app performs in the wild rely on qualitative feedback (Reddit, dogfood, manual testing) rather than numbers.
- "How many people used the app today" is genuinely unknown. We'll observe Vercel's bandwidth and function-invocation counts as a coarse proxy — they tell us *something*, but not *who* or *what feature*.
- If the app gets a viral moment, we'll see it via Vercel's bandwidth charts rather than a live analytics dashboard. Less satisfying but functionally adequate.
- Cross-route navigation patterns, drop-off rates, and feature-discovery questions ("does anyone find the search box?") are unanswerable without instrumenting. Plan to revisit if these questions start mattering more than the privacy posture.

## Revisit when

- A specific product question arises that direct feedback genuinely cannot answer, *and* the question is important enough to justify the cost. ("Does anyone use favorites?" probably *can* be answered through feedback; "what's the typical commute-time arrival window the user is checking?" probably can't.)
- The bandwidth profile changes enough that an additional ~5 KB script and ~one extra request per session becomes negligible (unlikely soon — we're already optimizing the other direction).
- Real-user performance measurement becomes load-bearing for decisions and Lighthouse-style synthetic numbers stop being enough. At that point a tiny, self-hosted web-vitals reporter is the first thing we'd add.
- If we decide to add analytics, the choice should be a fresh ADR — Plausible-style aggregate counts, Sentry-style error reporting, and web-vitals-style perf RUM are three different products with three different trade-offs.
