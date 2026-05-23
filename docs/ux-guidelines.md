# UX Guidelines

How the app looks, feels, and reacts. This doc translates the product requirements from `product-requirements.md` into concrete visual and interaction patterns. It's the design contract — not pixel-perfect mockups, but the rules a designer or developer should not violate without discussion.

## Design principles

These are the *philosophy* — every concrete decision below should be traceable back to one of them.

1. **Speed over features.** A fast app with three features beats a slow app with thirty. If a feature can't load in under a second once cached, it doesn't ship.
2. **Glanceable in two seconds.** The user is at a bus stop, one-handed, in a hurry. The most important answer should be readable without focusing.
3. **Honesty over polish.** Cancelled buses, stale data, denied permissions — all of these get told to the user clearly, never hidden behind clever UX.
4. **Mobile-first, one-handed.** Primary actions reachable by the thumb on a 6" phone. Desktop is a fallback, not the target.
5. **Universal cues + words.** Icons accelerate recognition for people who know the system; labels make the app usable for people who don't, and accessible to screen readers.
6. **Calm by default.** No animations for animation's sake. No notifications-yet-to-come. No fake activity. The app does its job and gets out of the way.

## Visual system

### Color

Status colors form the semantic spine of the UI. They are not used for decoration. Every token has a light-mode and dark-mode value; CSS variables wired through the Tailwind preset (`packages/components/src/tailwind-preset.ts`) swap with the `.dark` class on `<html>`, so components write one class (`bg-status-live`) and both modes work.

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `status-live` | `#16a34a` (green-600) | `#4ade80` (green-400) | Live, real-time data; bus is coming as predicted |
| `status-warn` | `#ca8a04` (yellow-600) | `#facc15` (yellow-400) | Delayed, soft disruption warning, stale data |
| `status-cancelled` | `#dc2626` (red-600) | `#f87171` (red-400) | Cancelled trip, strong disruption, network error |
| `primary` | `#0066CC` | `#60a5fa` (blue-400) | Brand color, primary actions, links |
| `surface` | `#ffffff` | `#111827` (gray-900) | Page background |
| `surface-elevated` | `#f9fafb` (gray-50) | `#1f2937` (gray-800) | Cards, raised surfaces |
| `fg` | `#111827` (gray-900) | `#f9fafb` (gray-50) | Body text |
| `fg-muted` | `#6b7280` (gray-500) | `#9ca3af` (gray-400) | Secondary metadata (timestamps, scheduled time when there's also a live time) |
| `divider` | `#e5e7eb` (gray-200) | `#374151` (gray-700) | Borders and dividers |

Each token becomes a Tailwind utility prefix: `bg-status-live`, `text-fg-muted`, `border-divider`, etc. Opacity modifiers work too (`bg-status-live/10`) thanks to the `<alpha-value>` substitution.

All status colors must pass **WCAG 2.1 AA contrast (4.5:1)** on both `surface` and `surface-elevated`, in both light and dark modes. The chosen tokens above are verified. **Never communicate status with color alone** — pair with text and/or icon.

The dark-mode shades are intentionally *lighter* than their light-mode counterparts. Saturated dark-color status badges (e.g., `red-600` on a near-black background) look harsh and fail contrast; the `-400` variants land in the sweet spot for vividness and readability.

### Theme toggle

- **Default:** follow the OS preference via `prefers-color-scheme`. A user who has dark mode set system-wide gets dark mode automatically on first open.
- **Override:** a three-way selector in Settings — `Auto` (default, follows OS), `Light`, `Dark`. Persisted in `localStorage` under e.g. `theme-preference`.
- **Implementation:** Tailwind's `class`-based dark mode (`darkMode: 'class'` in `tailwind.config.js`), with a small bootstrap script that reads the saved preference (or `prefers-color-scheme` if absent) and adds/removes `dark` on `<html>` *before* the app renders. This avoids the white-flash-on-load that media-query-only dark mode causes when the user prefers dark.
- No transition animation on theme change — it's instant. Animated theme swaps are showy and rarely good.

### Typography

System font stack — fast, native-feeling, no web font payload:

```
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title | 24px | 700 | "Favorites," "Nearby stops" |
| Stop name | 18–20px | 600 | Header of a stop card |
| Route badge | 16px | 700 | The route number / short name |
| Arrival time (primary) | 28–32px | 700 | "3 min" — the headline answer |
| Arrival time (secondary) | 16px | 500 | "18 min," "33 min" |
| Body | 16px | 400 | Default; minimum readable size on mobile |
| Metadata | 13–14px | 400 | "Last updated 2 sec ago," "Scheduled 12:30" |

Line-height: 1.4 for body, 1.2 for headings and arrival times. Never below 16px for body text.

### Spacing

Use a 4px base. Common values: 4, 8, 12, 16, 24, 32, 48. Tailwind's default spacing scale aligns.

### Touch targets

Minimum **44×44 px** for any tappable element. This is non-negotiable for accessibility and one-handed use. Small visual elements (e.g., a star icon) get an invisible expanded hit area.

### Iconography

Sparing use. Always paired with a text label or `aria-label`. Recommended icons (Lucide / Heroicons style):

- ⭐ Star — favorite
- 🚍 Bus — route indicator (decorative; not relied on for meaning)
- 📍 Pin — location / nearby stops
- ⏱ Clock — time-related metadata
- ⚠ Warning triangle — disruption
- 👥 People — occupancy (categorical)
- ⟳ Refresh — manual refresh
- ← Back — navigation

## Component implementation patterns

How components are built. These rules apply to every component in `@atl-transit/components`.

### Brand flows in one direction: tokens → preset → variants

1. **Tokens** in `packages/components/src/tokens/` are the source of truth for the brand. Named semantic roles (`statusLive`, `statusCancelled`, `primary`), not raw hex strings scattered through code.
2. The **Tailwind preset** in `packages/components/src/tailwind-preset.ts` maps those tokens onto Tailwind's theme, producing class names like `bg-status-live` and `text-status-cancelled`. The webapp's Tailwind config extends this preset and inherits the same names.
3. **Components consume tokens via variants**, never by writing hex codes or by re-declaring colors. If a component needs a color, that color must already exist as a token.

This means the only way to change the brand is to change a token. Single point of edit, no drift.

### Variants declared via CVA

Every visual variant a component supports is declared up-front with `class-variance-authority`. This makes the component's vocabulary explicit and type-safe:

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const badge = cva('inline-flex items-center rounded px-2 py-0.5 text-sm font-medium', {
  variants: {
    severity: {
      success: 'bg-status-live/10 text-status-live',
      warning: 'bg-status-warn/10 text-status-warn',
      danger:  'bg-status-cancelled/10 text-status-cancelled',
      neutral: 'bg-surface-elevated text-fg-muted',
    },
  },
  defaultVariants: { severity: 'neutral' },
});

export interface BadgeProps extends VariantProps<typeof badge> {
  children: React.ReactNode;
}

export function Badge({ severity, children }: BadgeProps) {
  return <span className={badge({ severity })}>{children}</span>;
}
```

### No styling escape hatches

Components in `@atl-transit/components` **do not accept** `className`, `style`, or any other styling-override prop. Consumers cannot reach in and change how a component looks.

If the webapp needs a Badge to look slightly different, the answer is **not** to override styles. It's to:

1. Check whether an existing variant already covers it.
2. If not, add a new variant to the component's CVA declaration.
3. Use it from the webapp via the variant prop.

This is the price of having the components package be a real design system instead of a styling free-for-all. The compensation is that brand changes are mechanical, not archaeological.

### Layout is the parent's job

Components own their *internal* look — colors, padding, typography, icon placement. They do **not** own their *external* layout — margin, position, width in a grid. That's the parent's responsibility.

In practice this means components rarely set `margin-*` or `position` classes on their outermost element. The parent (`features/*/`, a page, or another organism) wraps them in a layout component (`<Stack>`, `<Grid>`) or applies layout classes to a wrapping div.

### Tests live next to the component

Each component has a `.test.tsx` sibling. Coverage expectations:

- One render test per declared variant — asserts the variant prop produces the expected role/text/accessible state. (Not a pixel snapshot — that's brittle.)
- One behavior test per interaction (click, focus, keyboard) when present.
- Accessibility assertions: focus visibility, correct ARIA roles, screen-reader text.

Tests use Vitest + React Testing Library. Run on save in dev, gate-blocking in CI.

## Component patterns

The components below are the building blocks. The screens later in this doc compose them.

### Bus row — the workhorse

The bus row is the most-displayed UI element in the app. It must answer Job 1 at a glance.

**Live, on-time:**
```
┌────────────────────────────────────────────┐
│  ⏱  3 min                                  │
│     Scheduled 12:34 · Seats available      │
└────────────────────────────────────────────┘
```

- Primary line: the live ETA in large type (`status-live` color).
- Secondary line: scheduled time (so the user knows how far off the prediction is) + occupancy when available.

**Live, delayed:**
```
┌────────────────────────────────────────────┐
│  ⏱  8 min                                  │
│     Scheduled 12:34 · 4 min late           │
└────────────────────────────────────────────┘
```

- Same shape, but secondary line surfaces the delay. Use `status-warn` color for the ETA when delay exceeds a threshold (proposed: 3+ minutes late).

**Cancelled:**
```
┌────────────────────────────────────────────┐
│  ⚠  Cancelled                              │
│     Scheduled 12:34                        │
└────────────────────────────────────────────┘
```

- Primary line is text "Cancelled" in `status-cancelled` color, with strikethrough decoration.
- Scheduled time still shown so the user can see *which* trip was the one cancelled. Critical for "is my bus actually coming or just the one *after* mine?"
- Must include a non-color signal (the warning icon + the word "Cancelled" + strikethrough). Color carries reinforcement, not meaning.

**No live data:**
```
┌────────────────────────────────────────────┐
│  ⏱  12:34                                  │
│     Scheduled · No live data               │
└────────────────────────────────────────────┘
```

- Primary line shows the scheduled time directly (not an ETA, since we can't predict).
- Secondary line says "No live data" explicitly. Muted color (`text-muted`), but not red — this is informational, not an error.

### Stop card (favorites view, home screen)

Compact form for the home screen. Shows the next 1–2 buses with the most important status:

```
┌──────────────────────────────────────────────┐
│  Virginia Ave @ N Highland         ⭐         │
│  ──────────────────────────────────────────  │
│  Route 36     3 min      Live                │
│  Route 102    Cancelled                      │
└──────────────────────────────────────────────┘
```

- Star toggles favorite. Filled = favorited, outlined = not.
- Up to 2 routes shown; "Tap for more" if there are more.
- The whole card is tappable → opens the full stop detail view.

### Stop detail view

The full live arrivals screen. Groups bus rows by route, so Job 2 ("is my route okay?") is visible alongside Job 1.

```
┌──────────────────────────────────────────────┐
│  ←  Virginia Ave @ N Highland        ⭐       │
│  ──────────────────────────────────────────  │
│                                              │
│  Route 36 — Decatur Station                  │
│  ⏱  3 min                                    │
│      Scheduled 12:34 · Seats available       │
│  ⏱  18 min                                   │
│      Scheduled 12:49                         │
│  ⏱  33 min                                   │
│      Scheduled 13:04                         │
│                                              │
│  Route 102 — Lindbergh Center  ⚠ Disrupted   │
│  ⚠  Cancelled                                │
│      Scheduled 12:42                         │
│  ⚠  Cancelled                                │
│      Scheduled 12:57                         │
│  ⏱  27 min                                   │
│      Scheduled 13:12                         │
│                                              │
│  ──────────────────────────────────────────  │
│  Last updated 4 sec ago    ⟳ Refresh         │
└──────────────────────────────────────────────┘
```

- Each route has a header with its short name, headsign, and (if applicable) the disruption badge.
- Bus rows under each route, in scheduled order (next-first).
- Cancelled rows are kept in place, not hidden, not pushed to the bottom — chronological is honest.
- "Last updated N sec ago" + manual refresh affordance at the bottom (always visible without scrolling on a typical phone screen).

### Disruption badge

- **Soft warning** (1 cancellation in next 5 trips at this stop): small yellow dot or `Delays` chip next to the route header. Tappable for a tooltip: "1 of next 5 trips cancelled."
- **Strong warning** (2+ cancellations): red `Disrupted` chip with warning icon. Same tap-for-tooltip behavior.
- Badge is *informational at the route header level only* — it does not duplicate onto each individual bus row.

### Occupancy indicator

A short text label, never alone — always paired with the ETA on the secondary line:

| `occupancyStatus` value | Display |
|---|---|
| `EMPTY` / `MANY_SEATS_AVAILABLE` | "Seats available" |
| `FEW_SEATS_AVAILABLE` | "Filling up" |
| `STANDING_ROOM_ONLY` | "Standing room only" |
| `CRUSHED_STANDING_ROOM_ONLY` / `FULL` | "Very crowded" |
| `NOT_ACCEPTING_PASSENGERS` | "Not accepting riders" |
| (absent) | Display nothing |

Translate via i18n. Do not show an icon for occupancy in v1 — the categorical text is the v1 UX. (Icons can be added later when we know which categorical labels users actually care about.)

### "Last updated" indicator

Three states:

- **Fresh** (under 60s old): `Last updated 4 sec ago` — neutral text-muted color.
- **Stale** (60s–5min old, refresh failing): `Last updated 2 min ago — couldn't refresh` — `status-warn` color.
- **Very stale** (5+ min old, refresh failing): `Last updated 12 min ago — data may be wrong` — `status-cancelled` color, accompanied by a banner offering manual refresh.

### Loading states

- **Initial load** (cold open): a skeleton screen mirroring the stop card / stop detail layout. Skeleton uses subtle pulse animation (respects `prefers-reduced-motion`).
- **Refresh in progress** (warm): no full skeleton; show a subtle progress indicator at the top or a "Refreshing..." text near the timestamp. Do not blank out existing content during refresh.
- **Switching screens** (home → stop detail): instant if data is in cache; skeleton if not.

### Empty states

Every "empty" condition gets explicit, friendly text — never a blank screen.

- **No favorites yet:** "Favorite a stop to see it here." Below: a CTA "Find nearby stops" (if geolocation available) or "Browse routes."
- **No upcoming buses at this stop:** "No buses scheduled in the next hour. Next scheduled bus is at 5:42 AM." (Fall back to the next-known scheduled bus from static GTFS.)
- **Nearby stops, location unavailable:** "We couldn't find your location. Make sure location is enabled in your browser, or browse routes manually."

### Error states

- **Real-time feed unreachable on first load:** show static schedule + "Live data isn't available right now. Showing scheduled times." Do not block the screen.
- **Static GTFS missing (offline first-run):** "We need to download bus stop data to get started. Connect to the internet and try again." Retry button.
- **Permission denied (location):** see Empty state above. Explain how to re-enable.

## Key screens

### 1. Home

```
┌──────────────────────────────────────────────┐
│  Atlanta Transit                  ⚙ Settings │
│  ──────────────────────────────────────────  │
│  ⭐ Favorites                                 │
│                                              │
│  [Stop card — Virginia Ave @ N Highland]    │
│  [Stop card — Ponce @ Barnett]               │
│                                              │
│  📍 Nearby stops                              │
│                                              │
│  [Stop card — North Highland @ 8th St]      │
│  [Stop card — Highland Ave @ Cooledge]       │
│  [Stop card — N Highland @ Greenwood]        │
│                                              │
│  ──────────────────────────────────────────  │
│  Browse routes →                             │
└──────────────────────────────────────────────┘
```

- Favorites first, even if empty (with empty-state CTA).
- Nearby stops second, if location available.
- "Browse routes" footer link as the last-resort entry point.

### 2. Stop detail

See "Stop detail view" above.

### 3. Route browse (Should-have)

```
┌──────────────────────────────────────────────┐
│  ←  Browse routes                            │
│  ──────────────────────────────────────────  │
│  2     North Decatur                         │
│  3     Auburn Avenue                         │
│  5     Piedmont Road                         │
│  36    Virginia-Highland                     │
│  ...                                         │
└──────────────────────────────────────────────┘
```

Tapping a route → list of stops in order → tap stop → stop detail.

### 4. First-run / permissions

Before the browser geolocation prompt fires, an in-app explanation:

```
┌──────────────────────────────────────────────┐
│                                              │
│           📍                                  │
│                                              │
│   Find stops near you                        │
│                                              │
│   We'll use your location to show stops      │
│   you can walk to right now. Your location   │
│   stays on your device.                      │
│                                              │
│   [ Allow location ]                         │
│                                              │
│   Skip for now                               │
│                                              │
└──────────────────────────────────────────────┘
```

- "Allow location" triggers the browser prompt.
- "Skip for now" routes the user to favorites/browse without ever showing the browser prompt (which is annoying once dismissed).

### 5. Settings / About

Plain list. Items: theme (Auto / Light / Dark), language, "Add to home screen" instructions, About, MARTA attribution, disclaimer, license link, version.

## Interaction patterns

| Action | Trigger | Behavior |
|---|---|---|
| Open a stop | Tap stop card | Push stop detail view |
| Favorite a stop | Tap star on stop detail | Toggle; subtle confirmation (no modal) |
| Unfavorite | Tap star (filled) | Toggle; undo toast for 4 seconds |
| Refresh arrivals | Pull-to-refresh OR tap ⟳ on stop detail | Immediate fetch; preserve scroll position |
| Tap disruption badge | Tap badge | Tooltip with detail ("3 of next 5 trips cancelled") |
| Navigate back | System back / swipe / ← button | Returns to previous view, restores scroll |

**Long-press to favorite** (suggested in original spec) — I'd omit in v1. Long-press is a discoverability black hole on touch devices; the star icon on the stop detail is sufficient and obvious. Revisit if dogfooding shows the extra tap is friction.

**Swipe-left to delete favorite** (suggested in original spec) — also omit in v1. Same reasoning: the unfavorite star is on the stop detail. v2 could add swipe on the home screen if there's demand.

### Auto-refresh

- **Stop detail:** every 30 seconds while foregrounded.
- **Home screen (favorites + nearby):** fetch once on view open; do not poll. Re-fetch when the user navigates away and comes back, or on pull-to-refresh.
- All polling pauses on tab blur and resumes on focus. Never poll when the PWA is backgrounded.

## Accessibility specifics

- **Screen reader flow:** every screen has a single `<h1>` landmark; bus rows are an unordered list (`<ul>` / `<li>`) so a screen reader announces "list, 3 items."
- **Live regions:** the "Last updated" timestamp lives in an `aria-live="polite"` region. The disruption badge lives in `aria-live="assertive"` when it transitions from no-warning to strong-warning (the user wants to know).
- **Keyboard nav:** Tab order follows visual order. Enter activates the focused element. Esc closes any modal/tooltip.
- **Focus styles:** visible focus ring on every focusable element. Never `outline: none` without a visible substitute.
- **Reduced motion:** all skeleton pulses, tooltips, and toasts respect `prefers-reduced-motion: reduce` (set animation duration to 0).
- **Color contrast:** verified for every text/background combination in the visual system above.

## Motion and animation

- Used **only** to signal that something is happening, never for decoration.
- Default duration: **150ms** for state changes, **250ms** for entries/exits.
- Easing: standard ease-out for entries, ease-in for exits.
- Skeleton pulse animation respects `prefers-reduced-motion`.
- No parallax, no scroll-jacking, no carousels.

## What this doc is *not*

This isn't a Figma file. It's the *rules* a designer or developer should follow. Specific pixel layouts and image assets are produced by implementing this doc, not by replacing it.

The technical implementation (component file structure, state management, CSS strategy) lives in `architecture.md`.
