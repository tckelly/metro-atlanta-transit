# CLAUDE.md

## Project Overview

**Atlanta Transit** is a Progressive Web App (PWA) for real-time MARTA bus tracking in metro Atlanta. The goal is best-in-class real-time bus support — better UX than MARTA's website, faster than Google Maps, and more focused than generic transit apps.

- **Status:** Pre-launch (v0.0.1) — the three core jobs are built; currently in M5/M6 polish + launch-prep (see `docs/roadmap.md`)
- **Audience:** Atlanta bus commuters; solo dev project, open source
- **Docs:** Authoritative info lives in `docs/` — see the Docs Map below.

## Docs Map

- `docs/vision.md` — problem, user, value, v1 non-goals
- `docs/personas-and-jobs.md` — primary persona, three jobs-to-be-done
- `docs/data-and-apis.md` — MARTA feed shape (verified against `sample-data/`)
- `docs/product-requirements.md` — v1 features with acceptance criteria
- `docs/ux-guidelines.md` — visual system, components, screens
- `docs/architecture.md` — workspace layout, data flow, polling lifecycle
- `docs/adr/` — immutable decision records for load-bearing choices
- `docs/roadmap.md` — v1 milestones, launch criteria, v2 horizons

`docs/marta-project-spec.md` is the original brain dump, kept as historical context.

## Tech Stack

- **Framework:** React 18+ with TypeScript (strict mode)
- **Build:** Vite
- **Styling:** Tailwind CSS (mobile-first, utility-first)
- **State:** React Context API (MVP); evaluate alternatives as complexity grows
- **i18n:** react-i18next (English + Spanish)
- **Hosting:** Vercel (free tier)
- **Data:** MARTA GTFS-Realtime feeds (Protocol Buffers, no auth for bus data)
- **Storage:** localStorage for persistence, Service Worker cache for offline/PWA
- **Toolchain:** Node 22+, pnpm 10+

## Project Layout

pnpm monorepo with four packages. Cross-package imports are constrained by ESLint (`eslint-plugin-boundaries`) — respect those boundaries when adding new code.

```
metro-atlanta-transit/
├── docs/                ← vision, architecture, ADRs, roadmap, UX guidelines
├── sample-data/         ← committed MARTA feed snapshots used as test fixtures
├── packages/
│   ├── web/             ← the PWA itself (@atl-transit/web)
│   ├── components/      ← atomic-design UI library (@atl-transit/components)
│   ├── gtfs/            ← protobuf decoders + types (@atl-transit/gtfs)
│   └── utils/           ← pure helpers (@atl-transit/utils)
└── pnpm-workspace.yaml
```

## Local Commands

```bash
pnpm typecheck                                  # workspace-wide TypeScript check
pnpm lint                                       # ESLint with package-boundary enforcement
pnpm test                                       # Vitest across all packages
pnpm --filter @atl-transit/web dev              # Vite dev server (port 5173)
pnpm --filter @atl-transit/web build            # production bundle
pnpm --filter @atl-transit/web preprocess-gtfs  # refresh static GTFS from MARTA (~30MB; skipped if <24h old, --force overrides)
```

## How to Work With Me

**Collaborative and educational.** Discuss approaches before implementing significant changes. Explain the "why" behind decisions so I learn. Be proactive — suggest improvements, catch issues, propose next steps — but don't implement without discussing first.

I want a robust, well-designed app intended for a real audience. Don't treat this as a throwaway hobby project.

### What I value

- Clear reasoning for architectural decisions
- Being told when the spec's approach isn't the best option
- Honest feedback on code quality and design
- Catching things I might miss (type safety gaps, edge cases, accessibility)

## Code Standards

### TypeScript

- **Strict mode ON.** `noImplicitAny`, `strictNullChecks`, all strict flags enabled.
- Prefer strict typing. Avoid `any`. Use `unknown` and narrow with type guards.
- Occasional `as` casts are acceptable **with a comment explaining why**.
- Never use `@ts-ignore` or `eslint-disable` to suppress problems — fix the root cause.
- Validate external data (API responses, localStorage reads, URL params) with Zod schemas, not type assertions.

### Code Style

- **Readable over clever.** Prefer explicit, straightforward code. No "magic" one-liners.
- **Self-documenting names.** Code should read clearly without comments. Add comments only for non-obvious intent, trade-offs, or workarounds.
- **Conservative dependencies.** Don't add a package for something we can do simply. Justify new dependencies.
- **No premature abstraction.** Build for what we need now. Don't speculate on future functionality or over-engineer.
- **Brand values through semantic tokens.** Color, typography, and surface come from the design-system preset, never raw Tailwind palette classes. A brand refresh should be a single edit. See `docs/ux-guidelines.md`.

### Architecture

- **Modular components.** Separate presentational (dumb) and container (smart) components.
- **Atomic design in `@atl-transit/components`.** Atoms, molecules, organisms. Props are visual-semantic only (`severity`, `primaryStyle`, `icon`) — never domain (`isCancelled`, MARTA-specific status). The web package maps domain status to visual props at the boundary (see `packages/web/src/features/stops/busRowMapper.ts` and ADR-0003).
- **Reusable UI components.** Build a component library mindset — extract and reuse.
- **Pure business logic.** Keep business logic in framework-agnostic utility functions (`utils/`), not embedded in React components.
- **Feature-based organization.** Group by feature/domain where it makes sense.
- **Files under 500 lines.** If a file grows beyond this, break it up.
- **Consult ADRs before reversing load-bearing decisions.** `docs/adr/` records the trade-offs that motivated each choice. If a constraint changes (e.g., CORS forcing a backend proxy), supersede with a new ADR rather than silently editing code in conflict with an existing one.

### Error Handling

- **Best UX above all.** The user should always see something useful — never a blank screen or raw error.
- **Graceful degradation.** If real-time data fails, fall back to cached data or schedules. Show clear status ("Last updated 5 min ago").
- **Error boundaries** at route/feature level — isolate failures so one broken feature doesn't take down the app.
- **Explicit error states** for every async operation — loading, success, error, empty.

### Accessibility

- **Build it in from day one.** This is not a "fix later" item.
- Semantic HTML elements (`nav`, `main`, `article`, `button` not `div` with onClick).
- ARIA labels where semantic HTML isn't sufficient.
- Keyboard navigation for all interactive elements.
- Color contrast meeting WCAG 2.2 AA minimum.
- Screen reader tested for core flows.

## Testing

- **TDD for non-trivial logic — run the failing test before writing the implementation.** A test that's never been red doesn't prove it can catch a regression; it only proves the assertion matches today's code. Tests-after is fine for UI components and trivial glue.
- **Focus areas:** API response parsing, cache logic, geolocation calculations, arrival time formatting, error/edge cases.
- **Don't skip type safety for convenience.** Tests should use proper types, not `any` shortcuts.
- **Tests should not rewrite the module graph.** Reaching into another module's identity to swap it out couples the test to import paths and consumer wiring, and usually signals that the unit under test has no seam to receive its dependencies — pass collaborators in instead. `vi.mock` is a last resort; when you reach for it, leave a comment naming the seam that was missing.
- **Prefer real fixtures over synthesized inputs.** The `sample-data/` snapshots are the truth; tests built against them catch real schema drift.
- **Behavior over implementation.** Assert what a user (or screen reader) perceives — text, roles, ARIA state. Avoid asserting on CSS class strings or internal data shapes.
- **Testing library:** Vitest + React Testing Library for units; MSW for hook/integration tests that exercise the fetch pipeline; Playwright for E2E (later).

## Git & Commits

- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- **Branches:** `main` (production), `feature/*` (individual work)
- **Small, focused commits.** One logical change per commit.
- **Squash merge** feature branches to main.
- **Commit locally, but don't push during a work session.** Vercel rebuilds on every push to GitHub, and this is a free hobby-tier app, so pushes are batched. Make focused local commits as work progresses; the maintainer pushes to remote at the end.

## Documentation

- **Types are primary docs.** Well-named types and interfaces document intent better than comments.
- **JSDoc on public API surfaces.** Exported functions, hooks, and service modules get JSDoc with `@param`, `@returns`, and `@throws`.
- **Comments for the non-obvious.** Explain *why*, not *what*. Trade-offs, workarounds, external constraints.
- **Architecture docs in `docs/`.** High-level decisions, data flow, API integration notes.
- **README** with setup instructions, project purpose, and contribution guide.

## Security

Even though this is a client-side PWA consuming public APIs, maintain security-conscious habits:

- Validate and type-check all external data (API responses, localStorage reads, URL params).
- Sanitize any user-generated content before rendering.
- No secrets in source code. MARTA rail API key (if added) goes in `.env.local` (gitignored).
- Use HTTPS exclusively for all API calls.
- Content Security Policy headers via Vercel config.
- Keep dependencies updated; run `npm audit` regularly.

## Key Context

### MARTA Trademark

- Cannot use MARTA logo or "MARTA" in the app name.
- Can use MARTA's public data and reference "MARTA" descriptively.
- App name: "Atlanta Transit" or similar. Label as "Unofficial."
- Include disclaimer: "Not affiliated with or endorsed by MARTA."

### Data Sources

- **Bus real-time (no auth):** `https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb`
- **Trip updates (no auth):** `https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/tripupdate/tripupdates.pb`
- **GTFS static:** `https://itsmarta.com/google_transit_feed/google_transit.zip`
- **Rail API (optional, needs free key):** MARTA developer portal

### Design North Stars

- **Speed over features** — get the user their answer fast.
- **Glanceable** — understand the screen in 2 seconds.
- **Mobile-first** — one-handed use on a phone at a bus stop.
- **Best-in-class bus UX** — this is the differentiator over other Atlanta transit apps.
