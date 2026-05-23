# Atlanta Transit

An open-source Progressive Web App for real-time MARTA bus tracking in metro Atlanta — designed to answer one question fast: **"Is my bus actually coming?"**

> ⚠️ **Early development.** Not live yet. The bootstrap docs and data layer are in place; the user-facing app is being built next. See the [roadmap](./docs/roadmap.md) for what's next.

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
- **Vercel** hosting, no backend in v1 (static GTFS preprocessed at build time)
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

## Running locally

Requires **Node 22+** and **pnpm 10+**.

```bash
pnpm install
pnpm typecheck     # workspace-wide TypeScript check
pnpm lint          # ESLint with package-boundary enforcement
pnpm test          # Vitest across all packages
```

To refresh the static MARTA schedule data (downloads ~30MB from MARTA):

```bash
pnpm --filter @atl-transit/web preprocess-gtfs
```

The script skips the download when the bundle is less than 24 hours old; pass `--force` to refresh anyway.

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

## License

MIT. See [LICENSE](./LICENSE).

## Attribution

Real-time and schedule data provided by **MARTA** (Metropolitan Atlanta Rapid Transit Authority).

This project is **not affiliated with or endorsed by MARTA.** "Atlanta Transit" is the project name; the MARTA name and trademarks are referenced only descriptively where the app cites its data source.
