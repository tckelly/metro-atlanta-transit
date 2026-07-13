# Architecture

How the app is built. Translates the *what* and *how good* from `product-requirements.md` and `ux-guidelines.md` into a concrete technical structure. Where this doc says "X is decided," the *why* lives in a corresponding ADR (see `adr/`).

## Overview

A client-side Progressive Web App, structured as a **pnpm monorepo** with flat `packages/*` layout. The browser fetches MARTA's realtime data through a thin Vercel Edge Function proxy (one per feed — the smallest backend that makes browsers happy with MARTA's missing CORS headers; see ADR-0005). Static GTFS is preprocessed at build time and **split along the reference-data / schedule-data seam** (ADR-0006): small reference tables (`stops`, `routes`) ship as JSON bundled with the app and precached; the large schedule tables (`trips`, `stop_times`, `calendar`) are emitted as a `gtfs.sqlite` artifact and queried server-side through Vercel Node Functions (`/api/gtfs/*`). User state lives in `localStorage` only; no accounts, no server-side per-user state, and no analytics or telemetry (ADR-0007).

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (PWA)                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  @atl-transit/web                                  │  │
│  │  (pages → features → services + hooks + context)   │  │
│  │                                                    │  │
│  │     consumes ↓             ↓ consumes              │  │
│  │  ┌──────────────────┐  ┌─────────────────────┐     │  │
│  │  │ @atl-transit/    │  │ @atl-transit/gtfs   │     │  │
│  │  │ components       │  │ (decoders, types)   │     │  │
│  │  │ (atoms/molecules │  └─────────────────────┘     │  │
│  │  │  /organisms)     │                              │  │
│  │  └──────────────────┘                              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Service Worker (Workbox via vite-plugin-pwa)    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  localStorage  (favorites, theme, locale)        │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
                           │  /api/marta/*  ·  /api/gtfs/*
                           ▼
        ┌──────────────────────────────────────────────┐
        │  Vercel Functions                            │
        │  • /api/marta/*  → proxy MARTA GTFS-RT        │
        │    (edge; CORS shim; ~10s cache; ADR-0005)    │
        │  • /api/gtfs/*   → query gtfs.sqlite          │
        │    (node; better-sqlite3; ADR-0006)           │
        └─────────────────────┬────────────────────────┘
                              │ (realtime only)
                              ▼
                   ┌──────────────────────┐
                   │  MARTA GTFS-RT       │
                   │  (vehicles, trips,   │
                   │   alerts)            │
                   └──────────────────────┘

Build time (separate, runs in CI / Vercel):
  Pre-build: download itsmarta.com/google_transit.zip
           → preprocess CSV → small JSON  (stops, routes)
                            → gtfs.sqlite  (trips, stop_times, calendar)
           → emit small JSON to packages/web/public/gtfs/
           → emit gtfs.sqlite  to packages/web/api/_data/
  Build:   pnpm --filter @atl-transit/web build
```

## Workspace layout

```
metro-atlanta-transit/
├── pnpm-workspace.yaml
├── package.json                  # workspace root: dev deps only
├── tsconfig.base.json            # shared TS config
├── eslint.config.js              # shared lint config + boundaries (flat config)
├── docs/
├── sample-data/
└── packages/
    ├── web/                      # @atl-transit/web — the PWA + its serverless backend
    │   ├── package.json
    │   ├── vite.config.ts        # dev MARTA proxy + dev /api/gtfs middleware + vite-plugin-pwa
    │   ├── vercel.json           # function includeFiles (api/_data) + build-skip ignoreCommand
    │   ├── tailwind.config.ts    # extends preset from components
    │   ├── tsconfig.json
    │   ├── scripts/
    │   │   └── preprocess-gtfs.ts  # static GTFS build pipeline orchestrator (web-local)
    │   ├── api/                  # Vercel serverless functions — the "minimal backend"
    │   │   ├── marta/           # realtime proxies: tripupdates, vehiclepositions, alerts (edge; ADR-0005)
    │   │   ├── gtfs/            # schedule queries: stop-times, route-directions (node + better-sqlite3; ADR-0006)
    │   │   └── _data/           # build-emitted gtfs.sqlite, gitignored
    │   ├── index.html
    │   ├── public/
    │   │   └── gtfs/             # build-emitted stops.json + routes.json, gitignored
    │   └── src/
    │       ├── pages/            # route-level views (Home, StopDetail, Settings, Routes, RouteDetail)
    │       ├── features/         # composition + data wiring; co-located contexts live with their feature
    │       │                     #   (stops, favorites, nearby, routes, search, disruption,
    │       │                     #    realtime, settings, install, pull-to-refresh, toast)
    │       ├── services/         # martaRealtime, geolocation, storage, gtfs/ (GtfsRepository + impls)
    │       ├── buildtime/        # pure preprocess + sqlite-build logic (no I/O; unit-tested)
    │       ├── utils/            # app-specific (domain → visual mappings, etc.)
    │       ├── i18n/
    │       ├── styles/
    │       ├── types/
    │       ├── App.tsx
    │       └── main.tsx
    ├── components/               # @atl-transit/components — look and feel
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── atoms/            # Button, Badge, Icon, Spinner, Skeleton, Text
    │       ├── molecules/        # IconButton, StatusBadge, TimeDisplay, ListItem
    │       ├── organisms/        # BusRow, StopCard, RouteHeader, LastUpdatedIndicator
    │       ├── tokens/           # color tokens, spacing scale, type ramp
    │       ├── tailwind-preset.ts
    │       └── index.ts
    └── gtfs/                     # @atl-transit/gtfs — protobuf decoders + types
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── vehiclePositions.ts
            ├── tripUpdates.ts
            ├── alerts.ts
            ├── types.ts
            └── index.ts
```

### Why this layout

- **Flat `packages/*`** instead of `apps/` vs `packages/`. Mental simplicity; future iOS/Android (`packages/mobile`) drops in next to `packages/web` without restructuring.
- **`components` not `ui`** — avoids visual ambiguity with `pages/` and reads more clearly at import sites: `import { Button } from '@atl-transit/components'`.
- **Atomic-design split** inside `components` — guideline, not contract. Skip "templates" and "pages" tiers; those live in `packages/web/pages/`.
- **`gtfs` separate from `utils`** because protobuf decoding has a real dependency (`gtfs-realtime-bindings`) that no other package needs.

## The components / web boundary

This is the load-bearing design decision. The rule:

> **`components` knows about visual semantics. `web` knows about domain semantics. The mapping happens at the feature-container layer in `web`.**

Concretely:

```tsx
// packages/components/src/organisms/BusRow.tsx
export interface BusRowProps {
  primaryText: string;
  primaryStyle?: 'normal' | 'strikethrough';
  secondaryText?: string;
  severity: 'success' | 'warning' | 'danger' | 'neutral';
  icon?: 'clock' | 'warning';
  occupancyText?: string;
}
```

```tsx
// packages/web/src/features/stops/busRowMapper.ts
export function toBusRowProps(row: BusRow): BusRowProps {
  switch (row.status) {
    case 'live':
      return {
        primaryText: formatEta(row.predictedTime),
        secondaryText: `Scheduled ${formatTime(row.scheduledTime)}${row.occupancy ? ` · ${row.occupancy}` : ''}`,
        severity: row.delaySec > 180 ? 'warning' : 'success',
        icon: 'clock',
      };
    case 'cancelled':
      return {
        primaryText: t('status.cancelled'),
        primaryStyle: 'strikethrough',
        secondaryText: `Scheduled ${formatTime(row.scheduledTime)}`,
        severity: 'danger',
        icon: 'warning',
      };
    case 'no_live_data':
      return {
        primaryText: formatTime(row.scheduledTime),
        secondaryText: t('status.noLiveData'),
        severity: 'neutral',
        icon: 'clock',
      };
  }
}
```

Pros: `components` is genuinely portable. The day a second app appears, it consumes the same components without dragging in MARTA-specific types.

Cons: call sites are verbose, and the mapping is a place to forget cases. We mitigate by:

- Keeping mappers in `features/*/` so they live next to where they're called.
- Using a discriminated union for the domain type so TypeScript flags unhandled cases.

## Tech stack

- **Framework:** React 18+ with TypeScript (strict mode)
- **Build:** Vite (in `packages/web`)
- **Styling:** Tailwind CSS via a shared preset exported from `@atl-transit/components`
- **State:** React Context API — one context per concern; no global store in v1
- **Routing:** React Router v6
- **Validation:** Zod for external-data parsing
- **Protobuf:** `gtfs-realtime-bindings` (lives in `@atl-transit/gtfs`)
- **i18n:** `react-i18next`
- **PWA:** `vite-plugin-pwa` (wraps Workbox)
- **Testing:** Vitest + React Testing Library per package; Playwright for E2E (deferred)
- **Hosting:** Vercel
- **CI:** GitHub Actions for build, lint, test, and scheduled static-GTFS refresh

## Shared TypeScript config

`tsconfig.base.json` at the workspace root carries the strict settings; each package's `tsconfig.json` extends it and adds package-specific paths.

```jsonc
// tsconfig.base.json (excerpt)
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

No TypeScript project references for v1 — packages are consumed as source (not pre-built), so Vite's compiler handles the whole tree in one pass. Project references become useful if we ever publish packages to npm.

## Shared Tailwind preset

`packages/components/src/tailwind-preset.ts` exports the design tokens (colors, spacing, typography) as a Tailwind preset:

```ts
import type { Config } from 'tailwindcss';

export const preset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'status-live': { light: '#16a34a', dark: '#4ade80' },
        // ...
      },
    },
  },
};
```

`packages/web/tailwind.config.ts` extends it:

```ts
import { preset } from '@atl-transit/components/tailwind-preset';

export default {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx,html}',
    '../components/src/**/*.{ts,tsx}',  // scan component classes
  ],
};
```

Single-sourced tokens; the webapp can't accidentally drift from the design system.

## ESLint boundaries

The package boundaries are enforced by lint, not honor. Using `eslint-plugin-boundaries`:

| Package | May import from |
|---|---|
| `@atl-transit/gtfs` | external deps only |
| `@atl-transit/components` | external deps only (no domain knowledge, no app code) |
| `@atl-transit/web` | `components`, `gtfs`, external deps |

A violation is a build-blocking error in CI. This is what makes the architecture *real* rather than aspirational.

## Data flow

### Static GTFS — preprocessed at build time, split client/backend (ADR-0006)

The static GTFS feed is large (`stop_times.txt` alone can exceed 30 MB; the fully trimmed `stop-times.json` came out to ~253 MB). Loading raw GTFS in the browser is unacceptable for the 2-second cold-open target — and even the trimmed JSON is far too large to bundle and precache. So the preprocessed data is **split along the reference-data / schedule-data seam** (ADR-0006):

- **Reference data → client JSON, precached.** `stops.json` (~800 KB) and `routes.json` (~8 KB) are small and looked up *synchronously* from many UI sites (stop names in headers, route metadata in browse pages). They ship in the bundle and are precached by the service worker, so metadata access stays sync and lazy-loading skeletons don't ripple through every render.
- **Schedule data → `gtfs.sqlite`, served by the backend.** `trips`, `stop_times`, and `calendar` are the big tables. They're emitted as a single `gtfs.sqlite` artifact and queried *server-side* by Vercel Node Functions using `better-sqlite3`, behind two endpoints: `/api/gtfs/stop-times` and `/api/gtfs/route-directions`.

**Build-time pipeline.** The pure parse + transform logic lives in `packages/web/src/buildtime/` (`preprocessGtfs.ts` and `buildGtfsSqlite.ts` — testable, no I/O). `packages/web/scripts/preprocess-gtfs.ts` is the orchestrator: it downloads the ZIP, calls into those libraries, and writes the artifacts to disk.

1. Download `https://itsmarta.com/google_transit_feed/google_transit.zip`.
2. Unzip and parse: `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, optional `calendar_dates.txt`.
3. Emit **small reference JSON** to `packages/web/public/gtfs/` (gitignored — regenerated each build):
   - `stops.json` — `{ stopId, name, lat, lng, routeIds: string[] }[]`
   - `routes.json` — `{ routeId, shortName, longName, color? }[]`
4. Emit **`gtfs.sqlite`** (the `trips` / `stop_times` / `calendar` tables, indexed for the app's access patterns) to `packages/web/api/_data/` (gitignored). Vercel bundles it into the `/api/gtfs/*` functions via `includeFiles` in `vercel.json`. It's written in **rollback-journal mode** — a self-contained file with no `-wal` / `-shm` companions — so the read-only function bundle stays a single artifact.

**Runtime access — the `GtfsRepository` seam.** Consumers never touch the storage split directly. `services/gtfs/GtfsRepository.ts` defines the interface; the app wires a `HybridGtfsRepository` that serves the **sync** reference-data methods from the in-memory small bundle and delegates the **async** schedule queries to HTTP calls against `/api/gtfs/*`. `InMemoryGtfsRepository` implements the same interface against a full in-memory bundle and is used by tests. Swapping implementations is one provider in `App.tsx`, so a future migration (Postgres, Turso, or back to fully client-side) touches only the wiring.

**Dev/prod parity.** The same `/api/gtfs/*` handlers run in local dev: a Vite middleware plugin (`vite.config.ts`) imports the function handlers and serves them against the same `gtfs.sqlite`, so `pnpm dev` exercises the real backend path rather than a stub. (This closes the parity gap ADR-0006 originally accepted, where dev was to run `InMemoryGtfsRepository` against a full bundle.)

**Freshness.** A GitHub Actions cron (`.github/workflows/nightly-rebuild.yml`) pushes an empty `chore: nightly rebuild` commit at **08:00 UTC** (4am EDT in summer, 3am EST in winter — before MARTA's earliest morning service), which Vercel picks up as a deploy trigger and re-runs the build, regenerating `stops.json`, `routes.json`, and `gtfs.sqlite` from MARTA. The commit subject is load-bearing: `vercel.json`'s `ignoreCommand` matches it to force a build for an otherwise-empty diff. `pnpm --filter @atl-transit/web preprocess-gtfs` runs the pipeline directly (skipped if the output is <24h old; `--force` overrides). See ADR-0004 and ADR-0006.

**Failure mode:** if the static-GTFS download fails during build, the build fails loudly. We don't ship an app with stale or missing schedule data; the previous deploy stays live.

### Real-time — fetched on demand, polled while viewing

**Realtime proxy.** The client always requests `/api/marta/tripupdates`, `/api/marta/vehiclepositions`, and `/api/marta/alerts` — never MARTA's hostname directly. In production these paths are served by Vercel Edge Functions (`packages/web/api/marta/*.ts`); in dev they're served by a matching Vite proxy (`vite.config.ts`). Both rewrite to the corresponding `gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/*` path server-to-server, sidestepping CORS. MARTA's GTFS-RT endpoints do not send `Access-Control-Allow-Origin` (a blind spot in the original ADR-0001 assumption), so this is the smallest backend that lets the PWA actually load. The Edge Functions set `Cache-Control: s-maxage=10, stale-while-revalidate=30` so co-located clients collapse onto one upstream call per ~10s. See ADR-0005.

`packages/web/src/services/martaRealtime.ts` consumes decoders from `@atl-transit/gtfs` and exposes three functions:

```ts
async function fetchVehiclePositions(): Promise<VehiclePosition[]>
async function fetchTripUpdates(): Promise<TripUpdate[]>
async function fetchAlerts(): Promise<Alert[]>
```

Each:

1. Fetches the binary `.pb` from MARTA.
2. Decodes via `@atl-transit/gtfs`.
3. Maps decoded protobuf into our internal domain type.
4. Validates the result with a Zod schema before returning.

### The `useArrivals(stopId)` hook

Contract for a stop detail view:

```ts
const { rows, lastUpdated, isStale, error, refresh } = useArrivals(stopId);
```

- `rows: BusRow[]` — upcoming buses for this stop (joined static + real-time)
- `lastUpdated: number` — Unix timestamp of last successful fetch
- `isStale: boolean` — true when refresh failed or data is older than threshold
- `error: Error | null` — present if most recent fetch failed
- `refresh: () => void` — manual trigger

**Polling lifecycle:**

- Polls every 30s while `document.visibilityState === 'visible'`.
- Pauses on `visibilitychange` when hidden; resumes when visible.
- Cancels on unmount.
- A shared in-memory cache (`Map<stopId, CachedSnapshot>`) prevents double-fetches across components.

### Favorites — localStorage with validated reads

```ts
// packages/web/src/services/storage.ts
const FavoritesSchema = z.array(z.string()).max(10);

export function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem('atl-transit:favorites');
    if (!raw) return [];
    return FavoritesSchema.parse(JSON.parse(raw));
  } catch {
    return [];  // tamper or corruption: start fresh, don't crash
  }
}
```

Centralizing localStorage access keeps Zod validation enforceable — direct `localStorage.getItem()` calls in components are a lint violation.

## State management

React Context, scoped narrowly:

- `ThemeContext` — `'auto' | 'light' | 'dark'` preference, resolved mode, setter.
- `FavoritesContext` — current list, add/remove.
- `LocaleContext` — wraps react-i18next minimally for type-safety.

Most state stays local to components — `useState` for UI state, `useReducer` for multi-step interactions, custom hooks for shared logic.

**Why not Redux/Zustand:** v1 has limited cross-cutting state. If Context starts hurting (deep prop drilling, frequent re-renders), Zustand is the first thing to reach for — Redux is overkill at this scale.

## Routing

React Router v6, browser history (no hash routing — a PWA shouldn't have `#` in its URLs).

| Path | View |
|---|---|
| `/` | Home (favorites + nearby stops) |
| `/stop/:stopId` | Stop detail |
| `/routes` | Browse routes |
| `/routes/:routeId` | Stops on a route |
| `/settings` | Settings / About |

Each route is wrapped in an error boundary so a crash in one view doesn't blank the whole app.

## Theme system

- Tailwind's class-based dark mode: `darkMode: 'class'` (set in the shared preset).
- A small inline script in `packages/web/index.html` runs before React mounts:

```html
<script>
  (function() {
    const saved = localStorage.getItem('atl-transit:theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = saved === 'dark' || (saved !== 'light' && prefers) ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', mode === 'dark');
  })();
</script>
```

This prevents the flash-of-wrong-theme on cold load. Once React mounts, `ThemeContext` keeps localStorage + `<html class>` in sync.

## PWA setup

`vite-plugin-pwa` configured with:

- **Manifest** matching the spec — name, icons (192/512), `display: standalone`, theme color matches primary.
- **Workbox runtime caching:**
  - App shell + JS/CSS bundles: precache.
  - Preprocessed GTFS JSON: precache.
  - GTFS-RT `.pb` endpoints: NetworkOnly with a 5-second timeout, fall back to last cached response on failure (so offline shows last-known data, never blank).
- **Auto-update:** when a new SW is detected, a toast asks the user to reload. No silent updates mid-session.

## Error handling

- One `<ErrorBoundary>` per top-level route.
- Async hooks return discriminated state (`loading | success | error | empty`); UI components render explicit branches for each.
- Network failures *never* surface as blank screens — they degrade to last-cached data with a stale indicator.
- Errors logged to console in dev; a lightweight error tracker (Sentry-or-similar) wired in a follow-up.

## Internationalization

- `react-i18next` configured with `en` and `es` JSON bundles imported directly.
- Default `lng` is `navigator.language`, fallback `en`.
- TypeScript trick keeps the language files key-aligned:

```ts
import en from './en.json';
import es from './es.json' assert { type: 'json' };
const _typecheck: typeof en = es;  // fails to compile if es is missing keys
```

## Build and deployment

- **Local dev:** `pnpm --filter @atl-transit/web dev` — Vite dev server with HMR; component edits in `packages/components` hot-reload too.
- **Type-check (whole workspace):** `pnpm -r run typecheck`.
- **Lint:** `pnpm -r run lint`.
- **Test:** `pnpm -r run test` (Vitest per package).
- **Build:** `pnpm --filter @atl-transit/web build` (runs `prebuild` script first to refresh static GTFS).
- **Deploy:** automatic on push to `main` via Vercel — pointed at `packages/web`.
- **Preview deploys:** automatic on every PR/branch push.
- **Scheduled rebuilds:** GitHub Action nightly cron (08:00 UTC) pushes an empty commit to `main` to refresh static GTFS. See ADR-0004.

If/when `pnpm -r run X` orchestration becomes a bottleneck — slow CI, multiple apps, package builds with caching value — we add Turborepo. Not before.

## Testing strategy

Per CLAUDE.md, TDD for complex logic, tests-after for UI. Coverage focus:

- **Must have tests:**
  - `@atl-transit/gtfs` decoders — `sample-data/` snapshots are the fixtures.
  - `packages/web/src/services/storage.ts` — favorites validation edge cases.
  - The status-classification logic in the bus-row mapper. *The* business-logic core.
- **Should have tests:**
  - Component tests for the four bus row variants (live / live-delayed / cancelled / no-live-data).
  - Integration test for the favorites flow (add → persist → reload → see).
- **Deferred:**
  - E2E via Playwright — add once the app is stable enough that flakiness isn't an ROI sink.

## Cross-cutting decisions (ADRs)

The load-bearing architectural decisions have dedicated ADRs in `docs/adr/`. They cover the choices most likely to be questioned or forgotten — and where re-deriving the reasoning would cost the most:

- **ADR-0001:** No backend in v1 — *Superseded (partial) by ADR-0005*
- **ADR-0002:** pnpm monorepo with flat `packages/*` layout
- **ADR-0003:** Atomic-design `components` package with Option B (visual-semantics) boundary
- **ADR-0004:** Build-time static GTFS preprocessing with nightly rebuilds — *Superseded (partial) by ADR-0006*
- **ADR-0005:** Minimal backend proxy for MARTA realtime (Vercel Edge Functions)
- **ADR-0006:** Split static GTFS — small reference tables client-side, large schedule tables in SQLite behind the backend
- **ADR-0007:** No analytics, telemetry, or error-tracking in v1
- **ADR-0008:** Headsign (`route → headsign`) as the stop-direction disambiguator, precomputed onto `StopOut`

Other decisions (PWA-over-native, React-not-Svelte, Context-not-Redux, Tailwind, en+es-only, no-Turborepo, dark-mode-day-one, no-gesture-favorites) are defended in `vision.md`, `architecture.md`, `ux-guidelines.md`, or `product-requirements.md` and don't currently warrant standalone ADRs. If any of them gets seriously challenged, that's the signal to write one.

## What this doc is *not*

This is the *shape* of the system. Pixel layout lives in `ux-guidelines.md`, product scope in `product-requirements.md`, and roll-out timing in `roadmap.md`. It also doesn't list every npm dependency — those live in `package.json` files where they belong.
