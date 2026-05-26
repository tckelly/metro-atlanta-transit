# Contributing to Atlanta Transit

Thanks for the interest. This is a solo-maintained project right now, so the contribution surface is small — but the conventions below are real, and PRs that follow them are much more likely to land cleanly.

If you're here to file a bug or suggest a feature, the [issue tracker](https://github.com/tckelly/metro-atlanta-transit/issues) is the right place. For anything code-shaped, read on.

## Before you start

A handful of upfront reads will save you re-deriving project decisions:

- [README.md](./README.md) — what this app is and why.
- [docs/vision.md](./docs/vision.md) — the product north star and v1 non-goals. Most "should we build X?" questions are answered here.
- [docs/architecture.md](./docs/architecture.md) — workspace layout, data flow, polling lifecycle, PWA wiring.
- [docs/adr/](./docs/adr/) — load-bearing decisions and their trade-offs. If you're about to do something that reverses one of these, write a superseding ADR before the code change, not after.
- [docs/roadmap.md](./docs/roadmap.md) — what's planned, what's deferred, and the versioning convention (we're pre-stable; `0.0.x` until launch is battle-tested).

The `docs/` folder is intentionally heavy. Treat the early read as a feature, not a tax.

## Development setup

Requires **Node 22+** and **pnpm 10+**.

```bash
git clone https://github.com/tckelly/metro-atlanta-transit
cd metro-atlanta-transit
pnpm install
```

Verify your environment by running the full check:

```bash
pnpm typecheck                                    # workspace-wide TypeScript
pnpm lint                                         # ESLint with package boundaries
pnpm test                                         # Vitest across all packages
pnpm --filter @atl-transit/web preprocess-gtfs    # downloads MARTA's static GTFS (~30 MB)
```

The preprocessor populates `packages/web/public/gtfs/*.json` and `packages/web/api/_data/gtfs.sqlite`. Both are needed for the dev server to serve real data.

To run the app locally:

```bash
pnpm --filter @atl-transit/web dev                # Vite dev server at http://127.0.0.1:5173
```

To test against the production bundle (closer to what users see, with the minified JS, service worker, and edge-cache TTLs):

```bash
pnpm --filter @atl-transit/web build
pnpm --filter @atl-transit/web preview            # http://127.0.0.1:4173
```

## Branching and commits

- Branch from `main`. Name branches descriptively: `feat/stop-search`, `fix/realtime-binding`, `refactor/searchstops-rename`. No `dev` or shared long-lived branches.
- **Conventional Commits** — every commit subject uses one of `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, optionally with a scope: `feat(web): …`, `fix(gtfs): …`.
- **Small, focused commits.** One logical change per commit. A "rename + add feature" PR should be at least two commits.
- **Squash on merge** — PRs land as a single commit on `main`. The commit history above the squash line is your draft; the merge commit is the durable history.

The recent commit log is the style guide:

```
$ git log --oneline -10
```

## What "done" looks like

Before opening a PR, your branch must pass:

```bash
pnpm lint        # 0 errors, 0 warnings
pnpm typecheck   # 0 errors
pnpm test        # all tests green
```

PRs that fail any of these will not be merged. CI runs the same three checks; passing locally is a good proxy.

## Testing discipline

This project takes testing seriously. The conventions:

- **TDD for non-trivial logic.** Write the failing test first, run it red, then make it green. Tests authored alongside the implementation are tolerated; tests authored *after* the implementation lose much of their regression-catching value. Sometimes you'll see TDD violations in older commits — the convention is the goal, not the floor.
- **Real fixtures over synthesized ones.** `sample-data/` contains committed MARTA feed snapshots. Tests that use them catch real schema drift; tests that synthesize fake protobuf bytes are less trustworthy.
- **Assert on behavior, not implementation.** Test text, ARIA state, route navigations, callback firing. Don't test CSS class strings or internal data shapes.
- **Don't reach into module identity.** `vi.mock` is a last resort; if a unit needs a fake, expose the seam (pass collaborators in via props, options, or providers). When you do use `vi.mock`, leave a comment explaining why no seam exists.
- **Test boundaries match folder structure.** Component tests live next to the component, hook tests next to the hook, page tests next to the page.

## Code conventions

### TypeScript

- Strict mode everywhere. No `any`. Prefer `unknown` and narrow with type guards.
- Validate external data (HTTP responses, localStorage reads, URL params) with Zod schemas — type assertions are not validation.
- Occasional `as` casts are acceptable with a one-line comment explaining why.
- `@ts-ignore` and `eslint-disable` are last resorts. If you use one, comment why no clean fix exists.

### Architecture

- **Atomic-design in `@atl-transit/components`.** Atoms compose into molecules compose into organisms. Component props are visual-semantic only (`severity`, `primaryStyle`, `icon`) — never domain-coupled (`isCancelled`, `martaRouteId`). The web package maps domain status to visual props at the boundary (`features/stops/busRowMapper.ts` is the canonical example; ADR-0003 is the rationale).
- **Files under 500 lines.** Split before you hit it.
- **Feature-based organization in `packages/web/src/features/`.** Group by what the user perceives, not what the framework wants.
- **Pure logic in `utils/` modules, not React components.** Easier to test, easier to reuse, less to mock.

### i18n

- All user-facing strings live in `packages/web/src/i18n/en.json` and `es.json`. Never hardcode English (or Spanish) in components.
- Component packages stay i18n-agnostic — ARIA labels and visible text are passed in as props. Translation happens in the `web/` consumer.

### Brand and styling

- Color, typography, and surface come from the design-system preset (`packages/components/src/tokens.ts`). Don't reach for raw Tailwind palette classes like `bg-gray-700` — use the semantic tokens (`bg-surface`, `text-fg-muted`). See `docs/ux-guidelines.md`.
- A brand refresh should be a single edit in `tokens.ts`. If it isn't, that's a bug.

## Architecture decision records

If your change reverses or significantly modifies a load-bearing project decision, **write a superseding ADR before the code change.** Pattern:

1. Pick the next number: `docs/adr/ADR-0008-<short-slug>.md`.
2. Use the existing ADR header (`# ADR-XXXX: <title>`, `**Status:** Accepted`, `**Date:** YYYY-MM-DD`).
3. Sections: Context, Decision, Alternatives considered, Consequences, Revisit when.
4. If you're superseding an existing ADR, update the older one's status to `Superseded by ADR-XXXX` and link forward.

ADRs are for decisions *already made* with non-trivial trade-offs. For forward-looking ideas, use `docs/roadmap.md`. We've kept a clean separation so far; please preserve it.

## Pull requests

1. Push your branch to your fork (or directly if you have write access).
2. Open a PR against `main`. The title should follow Conventional Commits (the merge commit will use it).
3. PR description should answer:
   - What problem this solves (one sentence).
   - How a reviewer can verify the fix or feature (manual repro, screenshot, or "covered by tests").
   - Any decisions worth flagging (alternatives you considered, trade-offs you accepted).
4. Wait for CI to pass.
5. Address review comments by pushing additional commits — don't force-push during review.
6. Once approved, the maintainer will squash-merge.

## Reporting bugs

A good bug report has:

- What you tried (URL, action, device).
- What you expected.
- What actually happened (screenshot if visual; console error if technical).
- Browser + OS, especially for mobile (iOS Safari 17, Pixel 6a Chrome 122, etc.).

The repo includes committed sample MARTA feed snapshots in `sample-data/`; if your bug reproduces against one of those, mention which.

## License

By contributing, you agree your changes are licensed under the [MIT License](./LICENSE) — the same license the rest of the project uses.

## Questions

Open a discussion or an issue. There's no Slack, no Discord, no email list — keeping the surface area small while the project is solo-maintained.
