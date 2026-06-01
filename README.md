# Atlanta Transit

An open-source Progressive Web App for real-time MARTA bus tracking in metro Atlanta — designed to answer one question fast: **"Is my bus actually coming?"**

> 🚌 **Live at [metro-atlanta-transit.vercel.app](https://metro-atlanta-transit.vercel.app).** v0.0.1 is the first public release — three jobs ship for MARTA bus: live arrivals, route-disruption signal, and nearby stops. Rail to follow. See the [roadmap](./docs/roadmap.md) for what's next.

## Why this exists

MARTA bus riders need a fast, honest, mobile-first way to check live arrivals. The existing options aren't great:

- **MARTA's own site** is slow and not optimized for a 10-second mobile check.
- **Google Maps** is built for trip planning, not for "should I wait, or walk to the backup stop?"
- **Generic transit apps** don't lean into Atlanta-specific routes and cancellation patterns.

This app is opinionated about doing one thing well: **live arrivals, cold-open under 2 seconds, honest about cancellations**. No accounts, no ads, no nonsense.

## What it'll be

- A PWA you install from the browser — works on iOS, Android, desktop.
- Shows real-time arrivals for stops you favorite, plus stops near you via geolocation.
- Surfaces cancellations and route disruptions prominently — no silent omission.
- English and Spanish at launch.
- Dark mode from day one.
- Free, no accounts, no ads.

The [vision doc](./docs/vision.md) goes into more depth.

## Tech stack

- **React 18+** with TypeScript strict mode
- **Vite** build, **Tailwind CSS** for styling (shared preset, design tokens, no className escape hatches)
- **pnpm monorepo** with four packages: `web`, `components`, `gtfs`, `utils`
- **Atomic-design** components library — atoms, molecules, organisms — visual-semantics props only
- **Vitest** + **React Testing Library** for tests; **MSW** for hook tests when needed
- **Vercel** hosting; v1 ships a minimal serverless proxy for MARTA's GTFS-RT feeds (added after CORS testing showed browser-direct fetches aren't allowed). Static GTFS is still preprocessed at build time today.
- **GitHub Actions** for CI + nightly rebuilds against MARTA's feeds

Decisions with substantive trade-offs are captured in [architecture decision records](./docs/adr/).

## Project layout

```
metro-atlanta-transit/
├── docs/                          ← project docs (vision, architecture, ADRs, roadmap)
├── sample-data/                   ← committed MARTA feed snapshots used as test fixtures
├── packages/
│   ├── web/                       ← the PWA itself
│   ├── components/                ← @atl-transit/components (atomic-design UI library)
│   ├── gtfs/                      ← @atl-transit/gtfs (protobuf decoders + types)
│   └── utils/                     ← @atl-transit/utils (pure helpers)
└── pnpm-workspace.yaml
```

## Getting started

From a fresh checkout to a running dev server, assuming only `git` is installed.

### 1. Node 22 and pnpm 10

`.nvmrc` pins Node to v22. If you use [nvm](https://github.com/nvm-sh/nvm) (or fnm, asdf):

```bash
git clone https://github.com/<your-fork>/metro-atlanta-transit.git
cd metro-atlanta-transit

nvm install        # reads .nvmrc → installs Node 22 if missing, then activates it
corepack enable    # makes the pnpm CLI available at the version package.json requires
```

No version manager? Install Node 22+ directly from [nodejs.org](https://nodejs.org/), then run `corepack enable` from anywhere. Corepack ships with Node 22, so no separate `npm install -g pnpm` is needed.

### 2. Install dependencies

```bash
pnpm install
pnpm approve-builds       # interactive — approve native build scripts
```

`pnpm install` pulls every workspace package's deps. `pnpm approve-builds` then launches an interactive prompt for any packages that ship install scripts — currently `better-sqlite3` (the one that matters), and possibly `esbuild` and `protobufjs` — and persists your choices to `pnpm-workspace.yaml` under `allowBuilds`. Once that block is committed, future contributors don't have to re-approve; this step is mostly a safety net for adding new native deps later. pnpm 10+ default-denies install scripts for supply-chain safety, so without an approval the GTFS preprocessor's native SQLite binding never gets built.

### 3. Fetch MARTA's static schedule data

```bash
pnpm preprocess-gtfs
```

Downloads ~30 MB from MARTA, generates `packages/web/public/gtfs/{stops,routes}.json` for the client, and builds a local SQLite database that the dev server's `/api/gtfs/*` middleware queries. **The dev server can't start without this** — `App.tsx` fetches `/gtfs/stops.json` on cold open. The script skips the download if the bundle is less than 24 hours old; pass `--force` to refresh anyway.

### 4. Run the dev server

```bash
pnpm dev    # http://127.0.0.1:5173
```

Vite serves the PWA, proxies MARTA's realtime feeds, and runs the same `/api/gtfs/*` handlers Vercel runs in production — no `.env`, no API keys, no extra services to start.

### Day-to-day commands

```bash
pnpm typecheck                    # workspace-wide TypeScript
pnpm lint                         # ESLint with package-boundary enforcement
pnpm test                         # Vitest across all packages
pnpm build                        # production bundle (re-runs preprocess-gtfs as a prebuild step)
pnpm preprocess-gtfs --force      # refresh MARTA data ignoring the <24h cache
```

### Troubleshooting

- **`Could not locate the bindings file` for `better_sqlite3.node`** — pnpm 10+ default-denies install scripts, so the native binding never compiled. `pnpm-workspace.yaml` should already contain `allowBuilds.better-sqlite3: true`; if it does and you're still hitting this, the local install ran before the approval landed. Fix:
  ```bash
  pnpm install --force     # re-evaluates build queue with the committed approval
  ```
  `pnpm rebuild better-sqlite3` *looks* like the right command but is a silent no-op when pnpm's `.modules.yaml` cache says nothing is pending — don't be fooled by the lack of error output.

  If `pnpm-workspace.yaml` doesn't yet have `allowBuilds.better-sqlite3`, run `pnpm approve-builds` and commit the resulting change.
- **`GTFS backend middleware failed: … SQLite file is missing`** — step 3 was skipped or the local DB is stale relative to the schema. Run `pnpm preprocess-gtfs --force`.
- **`pnpm: command not found`** after `corepack enable` — open a new terminal, or run `hash -r` to clear the shell's command cache.
- **Stale dev output** — Vite caches aggressively. Hard-refresh (Cmd+Shift+R) or quit and restart `pnpm dev`.

## Where to learn more

The repo is intentionally heavy on docs. They're structured as a chain so each builds on the previous:

| Doc | What it answers |
|---|---|
| [vision.md](./docs/vision.md) | Problem, target user, value proposition, v1 non-goals |
| [personas-and-jobs.md](./docs/personas-and-jobs.md) | Primary persona + the three jobs-to-be-done |
| [data-and-apis.md](./docs/data-and-apis.md) | MARTA feed shape, verified against the committed sample data |
| [product-requirements.md](./docs/product-requirements.md) | v1 features with acceptance criteria |
| [ux-guidelines.md](./docs/ux-guidelines.md) | Visual system, component patterns, key screens |
| [architecture.md](./docs/architecture.md) | Workspace layout, data flow, polling lifecycle, PWA wiring |
| [adr/](./docs/adr/) | Immutable decision records for load-bearing choices |
| [roadmap.md](./docs/roadmap.md) | v1 milestones, launch criteria, v2 horizons |

## Privacy

Atlanta Transit does not track you.

- **No accounts.** Nothing to sign up for, nothing to log into.
- **No analytics, no telemetry, no session replay.** No Google Analytics, no Plausible, no Sentry, no third-party scripts. See [ADR-0007](./docs/adr/ADR-0007-no-analytics-in-v1.md) for the decision and the trade-off we're accepting (we launch without quantitative usage data).
- **No ads, no trackers, no fingerprinting.**
- **Favorites and preferences stay on your device.** Stored in `localStorage`. We never upload them.
- **Geolocation stays on your device.** When you grant location access, the coordinates are used in the browser only to rank nearby stops. Nothing leaves the device.
- **The only external requests** the app makes are to (a) our serverless proxy in front of MARTA's public realtime feeds and (b) Vercel's static asset CDN. MARTA's upstream sees one request per ~30 s per region, not per user.

The Settings page repeats this disclosure in-app for users who don't visit GitHub.

## License

MIT. See [LICENSE](./LICENSE).

## Attribution

Real-time and schedule data provided by **MARTA** (Metropolitan Atlanta Rapid Transit Authority).

This project is **not affiliated with or endorsed by MARTA.** "Atlanta Transit" is the project name; the MARTA name and trademarks are referenced only descriptively where the app cites its data source.
