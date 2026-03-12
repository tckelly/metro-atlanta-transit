# CLAUDE.md

## Project Overview

**Atlanta Transit** is a Progressive Web App (PWA) for real-time MARTA bus tracking in metro Atlanta. The goal is best-in-class real-time bus support — better UX than MARTA's website, faster than Google Maps, and more focused than generic transit apps.

- **Status:** Greenfield — early development
- **Audience:** Atlanta bus commuters; solo dev project, open source
- **Spec:** See `docs/marta-project-spec.md` for the full project vision. Treat it as a directional guide — follow the spirit but adapt specifics. Suggest better approaches when you see them.

## Tech Stack

- **Framework:** React 18+ with TypeScript (strict mode)
- **Build:** Vite
- **Styling:** Tailwind CSS (mobile-first, utility-first)
- **State:** React Context API (MVP); evaluate alternatives as complexity grows
- **i18n:** react-i18next (English + Spanish)
- **Hosting:** Vercel (free tier)
- **Data:** MARTA GTFS-Realtime feeds (Protocol Buffers, no auth for bus data)
- **Storage:** localStorage for persistence, Service Worker cache for offline/PWA

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
- Write type guards for runtime type checking of external data (API responses, localStorage).

### Code Style

- **Readable over clever.** Prefer explicit, straightforward code. No "magic" one-liners.
- **Self-documenting names.** Code should read clearly without comments. Add comments only for non-obvious intent, trade-offs, or workarounds.
- **Conservative dependencies.** Don't add a package for something we can do simply. Justify new dependencies.
- **No premature abstraction.** Build for what we need now. Don't speculate on future functionality or over-engineer.

### Architecture

- **Modular components.** Separate presentational (dumb) and container (smart) components.
- **Reusable UI components.** Build a component library mindset — extract and reuse.
- **Pure business logic.** Keep business logic in framework-agnostic utility functions (`utils/`), not embedded in React components.
- **Feature-based organization.** Group by feature/domain where it makes sense.
- **Files under 500 lines.** If a file grows beyond this, break it up.

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
- Color contrast meeting WCAG 2.1 AA minimum.
- Screen reader tested for core flows.

## Testing

- **TDD for complex logic.** Write tests first for business logic, data transformations, and tricky workflows. This yields better-designed code.
- **Tests after for UI.** Writing UI component tests after implementation is fine.
- **Focus areas:** API response parsing, cache logic, geolocation calculations, arrival time formatting, error/edge cases.
- **Don't skip type safety for convenience.** Tests should use proper types, not `any` shortcuts.
- **Testing library:** Vitest + React Testing Library for units; Playwright for E2E (later).

## Git & Commits

- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- **Branches:** `main` (production), `develop` (integration), `feature/*` (individual work)
- **Small, focused commits.** One logical change per commit.
- **Squash merge** feature branches to main.

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
