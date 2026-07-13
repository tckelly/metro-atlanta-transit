# ADR-0010: Secret-injecting proxy for MARTA rail arrivals

**Status:** Proposed
**Date:** 2026-07-13

## Context

We're adding real-time MARTA heavy-rail arrivals (see `docs/features/rail.md`). Unlike the bus GTFS-RT feeds, the rail endpoint requires an **API key passed as a query parameter**:

```
https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/developerservices/traindata?apiKey=xxxx-xxxx-xxxx-xxxx
```

We already run a minimal serverless proxy for the bus feeds (ADR-0005): two Edge Functions plus a shared `_proxy.ts` helper that fetches a **hard-coded, public, no-auth** upstream URL and streams the protobuf body back byte-for-byte. ADR-0005's entire risk argument rests on there being *nothing to protect* — it describes the surface as "an open relay for two specific upstream URLs," acceptable precisely because it holds no secret and accepts no user input.

Rail breaks both of those assumptions:

1. **There is now a secret.** The API key cannot live in the client — anything in the bundle or a client-issued request is publicly visible, which would leak the key (and, per MARTA's EULA, our key is our responsibility). So the key must be held server-side and appended to the upstream call by the proxy. This is the decisive reason for a proxy; CORS and the non-standard `:18096` port almost certainly block a direct browser fetch too, but key-exposure alone settles it.
2. **The response is JSON, not protobuf.** The `@atl-transit/gtfs` decoders don't apply. The proxy *can* cheaply decode/validate server-side (which the byte-passthrough bus proxy deliberately does not).

A secret-injecting proxy has a materially different threat model from ADR-0005's dumb relay: it must never echo the key back to the client, and a naive passthrough that forwards client-supplied query params could leak the key or let a caller override it. That's a load-bearing change, so it warrants its own ADR rather than a silent extension of ADR-0005.

**Runtime confirmation (2026-07-13).** Vercel's *Sensitive* environment-variable flag is at-rest / dashboard protection only — sensitive vars are decrypted at both build and runtime and exposed via `process.env`, and Edge Functions can read them. So the rail proxy can stay on the same Edge runtime as the bus proxies; the Sensitive flag does not force a switch to the Node serverless runtime.

## Decision

**Ship a dedicated secret-injecting Edge Function for rail arrivals, separate from the bus proxy helper, that reads the key from `process.env` and appends it to a hard-coded upstream URL server-side.**

Concretely:

- **New handler** `packages/web/api/marta/rail.ts` (Edge runtime, matching the bus handlers). It does **not** reuse `proxyToMarta` from `_proxy.ts` — that helper is a byte-passthrough for protobuf with no notion of a secret. Rail gets its own small helper (e.g. `_railProxy.ts`) with the same dependency-injected `fetch` seam for TDD.
- **Key handling — the load-bearing rules:**
  - The key is read **only** from `process.env.MARTA_RAIL_API_KEY` on the server. It is never a `VITE_`-prefixed var and is never imported into `packages/web/src/**` (per CLAUDE.md security rules).
  - The proxy **constructs the upstream URL itself** and appends the key. It does **not** copy the client's query string onto the upstream request. Any client-supplied `apiKey` param is ignored — the caller cannot override, read, or influence the key.
  - The key is **never echoed** in the response body, headers, or error messages. Error responses are generic (`502` + a static message), and the upstream URL is never reflected back verbatim in an error (it contains the key).
  - If `MARTA_RAIL_API_KEY` is unset/empty, the function fails fast with a `500` and a generic "rail not configured" message — it never calls upstream keyless (which would just 401 and waste a round-trip) and never leaks that the var is missing beyond a generic signal.
- **Server-side validation and trimming.** Because the payload is JSON, the function parses it, validates with a Zod schema (`railArrivalSchema`), and returns a normalized/trimmed body. Malformed upstream JSON collapses to a `502`, same failure posture as the bus proxy. A `?station=` filter to shrink the payload server-side is a **candidate, not v1** — start by returning the validated full response; add filtering only if payload size warrants it (mirrors the "server-side trip-update filtering" candidate in `roadmap.md`).
- **Edge cache.** Reuse the bus proxy's courtesy-cache approach (`s-maxage` + `stale-while-revalidate`), tuned to rail's refresh cadence once Phase-2 recon reveals `EVENT_TIME` freshness. One upstream call per region per TTL keeps us polite to MARTA and inside the free tier.
- **Dev parity.** The bus feeds use a pure Vite `server.proxy` URL rewrite (`vite.config.ts`), which cannot inject a secret. For rail, the Vite dev config reads `process.env.MARTA_RAIL_API_KEY` (loaded from the gitignored `.env.local`) and appends it in the `rewrite` — Vite config runs in Node, so it has access. This preserves the "same `/api/marta/...` URL shape in dev and prod, no client branching" property from ADR-0005. If wiring the key through the Vite proxy proves awkward, the fallback is running `vercel dev` for rail work (the ADR-0005 "revisit" trigger).

This does **not** supersede ADR-0005 — the bus proxy is unchanged. This ADR extends the backend's role to "a proxy that also holds one secret," and updates ADR-0005's threat model rather than replacing its decision.

## Alternatives considered

**Extend `proxyToMarta` with an optional `apiKey` / query-injection option.** Rejected. It would fold a secret-handling code path into a helper whose safety story is "holds no secret, forwards nothing." Overloading it blurs the two threat models and makes the byte-passthrough proxy a place a future edit could accidentally start echoing a key. A separate helper keeps each proxy's invariants local and legible.

**Pass the key from the client (e.g. injected at build time).** Rejected outright — any build-time value that reaches the browser bundle is public. This is the exact anti-pattern CLAUDE.md's security section and the `.env.example` comments forbid.

**Public CORS-proxy service.** Rejected for the same reasons as ADR-0005, plus we'd be handing our secret key to a third party. Non-starter.

**Store the key in a dedicated secrets manager (Doppler/Infisical/Vault).** Rejected as over-engineering for a single, effectively-never-rotated key guarding a free public feed. Vercel's Sensitive environment variable (encrypted at rest, write-only in the dashboard) plus gitignored `.env.local` locally is sufficient. Revisit only if secret count, collaborators, or rotation/audit needs grow (see Revisit when).

**Skip server-side validation, passthrough the JSON like the bus proxy.** Rejected. The JSON shape is documented-but-unverified (Phase-1 recon), `IS_REALTIME`/`DELAY` semantics are guesses, and validating at the boundary is cheap for JSON. A Zod schema at the proxy catches MARTA schema drift server-side and gives the client a guaranteed shape.

## Consequences

**Pros:**

- The API key never leaves the server — not in the bundle, not in a client request, not in a response or error. Meets the CLAUDE.md secret-handling bar.
- The bus proxy's safety story is untouched: its helper stays a dumb, secret-free relay.
- Server-side Zod validation means the client always receives a known shape, and schema drift surfaces as a clean `502` rather than a client-side parse explosion.
- Same runtime (Edge) and same `/api/marta/...` URL surface as the bus proxies — consistent mental model, no client env-branching.

**Cons:**

- A new dev-parity wrinkle: the Vite proxy must inject the key from `process.env`, which is more than the bus feeds' pure URL rewrite. If that proves fiddly, rail dev may require `vercel dev`.
- We now have a server component that *must not* leak a secret — a higher-stakes invariant than ADR-0005's. It needs explicit test coverage for the leak paths (key never in body/headers/errors; client `apiKey` param ignored).
- Server-side validation couples the proxy to MARTA's response shape. Mitigated by Zod (drift → `502`) and by pinning the schema against a real Phase-2 snapshot in `sample-data/`.
- Key rotation is a manual dashboard + `.env.local` step. Acceptable at one secret; not a rotation story that scales.

## Revisit when

- **Phase-2 recon lands a real payload.** The Zod schema, `IS_REALTIME`/`DELAY` handling, and cache TTL should be finalized against the snapshot in `sample-data/`, not the documented shape. This ADR's validation/cache specifics are provisional until then.
- **Payload size justifies server-side `?station=` filtering.** Add it then, not preemptively.
- **The client's field needs are known.** Narrow the schema's *required* set to the fields the UI actually consumes and make the rest optional — because the proxy drops records that fail validation, requiring an unused field means a drift in that field could silently drop records. Introduce the trimmed/normalized client DTO (parsed numbers, booleans, camelCase, `LINE` → token) at the same time.
- **A second secret arrives, collaborators join, or rotation/audit becomes a requirement.** At that point re-evaluate a dedicated secrets manager (Doppler/Infisical) over raw Vercel env vars — the trade-off that's over-engineering today.
- **The secret-injection pattern is needed for a third upstream.** If a general "authenticated upstream proxy" helper would then remove duplication, factor one out — but only once there are two real consumers.
