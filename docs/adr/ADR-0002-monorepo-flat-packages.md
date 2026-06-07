# ADR-0002: pnpm monorepo with flat packages/* layout

**Status:** Accepted
**Date:** 2026-05-23

> **Update 2026-06-06:** The `@atl-transit/utils` package was removed. After shipping v0.0.1, no shared pure helpers had emerged — the package remained empty. The flat `packages/*` decision and ESLint-enforced boundaries stand unchanged; only the package count moved from four to three. If a genuinely shared pure helper appears later, re-add the package and restore its row to the boundaries table.

## Context

The codebase will contain a PWA (the consumer-facing app), a UI component library (atomic-design atoms/molecules/organisms), GTFS protobuf decoders + types, and pure utility helpers (Haversine, formatters, etc.). These are conceptually distinct concerns with clean dependency edges between them — but they all live in one repository.

We need a workspace structure that:

1. Enforces clean boundaries — the UI library cannot accidentally import app-specific code.
2. Stays mentally simple for a solo dev.
3. Leaves room for future apps (e.g., a native mobile wrapper) without a structural rewrite.
4. Doesn't add tooling overhead that exceeds the benefit at our current scale.

## Decision

A **pnpm workspace with flat `packages/*` layout**. Four packages at v1 launch:

```
packages/
├── web/         # @atl-transit/web — the PWA
├── components/  # @atl-transit/components — atomic-design UI library
├── gtfs/        # @atl-transit/gtfs — protobuf decoders + types
└── utils/       # @atl-transit/utils — pure helpers
```

Package boundaries are enforced by ESLint (`eslint-plugin-boundaries`):

| Package | May import from |
|---|---|
| `utils` | external deps only |
| `gtfs` | `utils`, external deps |
| `components` | `utils`, external deps (no domain, no app code) |
| `web` | `components`, `gtfs`, `utils`, external deps |

A boundary violation fails CI. The architecture is *real*, not aspirational.

## Alternatives considered

**Single package with internal folder discipline.** Use `src/components/`, `src/services/`, `src/utils/` in one package, enforce "no cross-folder imports" via ESLint. Rejected because the discipline is the same either way, but a package boundary is a stronger structural signal — IDE-friendlier, harder to accidentally violate during a refactor, and prepares us for the day we want to publish or extract.

**Conventional `apps/` + `packages/` split.** The Turborepo / Nx norm: deployable things under `apps/`, libraries under `packages/`. Rejected because:

- For a solo dev with one app, the distinction adds folders without adding clarity.
- A future mobile app (`packages/mobile`) drops in as a sibling under flat `packages/*` without restructuring.
- Mental simplicity (one place to find everything) wins over conventional taxonomy.

**Turborepo from day one for task orchestration and caching.** Rejected for v1 because at four packages, with no real build steps in the libraries (they're consumed as TypeScript source by Vite), pnpm's native `-r` and `--filter` commands handle every workflow we have. Turborepo would be additive — we can adopt it the day we hit a concrete need (slow CI, multiple apps, package builds for npm publication).

## Consequences

**Pros:**

- Clean package boundaries enforced mechanically. `packages/components` cannot import from `packages/web` even if a tired developer tries.
- Future apps (`packages/mobile`, `packages/admin`, `packages/marketing`) drop in symmetrically. No structural change needed when scope grows.
- ESLint boundaries mean architectural drift is caught at lint time, not at code review.
- `pnpm` workspaces are zero-config beyond `pnpm-workspace.yaml`.

**Cons:**

- More boilerplate than a single package: per-package `package.json` and `tsconfig.json`, configuring TypeScript paths or the `exports` field for inter-package imports.
- Contributors unfamiliar with pnpm workspaces face a learning curve (small but real).
- `packages/web` reads slightly oddly to people expecting "packages" to mean "libraries." Trade-off accepted for mental simplicity.

## Revisit when

- We add a second app and find `pnpm -r run` orchestration painful — that's the signal to introduce **Turborepo** for parallelization and caching.
- We decide to publish `@atl-transit/components` to npm — that's the signal to add real build steps (tsup or similar), TypeScript project references, and per-package release tooling.
- The flat structure feels unclear with 8+ packages — split into subcategories (still no `apps/` vs `packages/`; maybe `packages/lib-*` vs `packages/app-*` if it helps).
