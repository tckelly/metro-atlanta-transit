import type { TFunction } from 'i18next';

import type { StopDirection } from '../buildtime/preprocessGtfs';

/**
 * String-builders for a stop's direction label, supplied by the caller so this
 * formatter stays framework/i18n-agnostic. The web surfaces build these from
 * `t`; tests pass fakes.
 *
 * `pair`/`more` are the *visible* forms (glyph, e.g. `11 → Collier Rd`);
 * `pairSpoken`/`moreSpoken` are the accessible forms a screen reader hears
 * (e.g. `Route 11 toward Collier Rd`), since the "→" glyph reads inconsistently.
 */
export interface DirectionsLabelStrings {
  pair: (route: string, headsign: string) => string;
  pairSpoken: (route: string, headsign: string) => string;
  more: (count: number) => string;
  moreSpoken: (count: number) => string;
}

/**
 * Build the visible/spoken string-builders from an i18next `t`. The
 * `directions.*` keys live in the locale files; this keeps the wiring in one
 * place so the three consuming surfaces don't each re-derive it. (The pure
 * `formatDirections` below stays i18n-agnostic; only this glue touches `t`.)
 */
export function directionsStringsFromT(t: TFunction): DirectionsLabelStrings {
  return {
    pair: (route, headsign) => t('directions.pair', { route, headsign }),
    pairSpoken: (route, headsign) => t('directions.pairSpoken', { route, headsign }),
    more: (count) => t('directions.more', { count }),
    moreSpoken: (count) => t('directions.moreSpoken', { count }),
  };
}

export interface DirectionsLabel {
  /** Visible text, using the "→" glyph. */
  visible: string;
  /** Accessible text for the element's aria-label; spoken, no glyph. */
  label: string;
}

/**
 * Format one `route → headsign` pair into its paired visible/spoken forms — the
 * single source of that pairing, so every surface that shows a bus's route +
 * destination (the disambiguator, the favorites arrival preview, the
 * stop-detail route-group header) renders identically and carries the same
 * a11y treatment via `DirectionLabel`.
 */
export function formatDirectionPair(
  route: string,
  headsign: string,
  strings: DirectionsLabelStrings,
): DirectionsLabel {
  return { visible: strings.pair(route, headsign), label: strings.pairSpoken(route, headsign) };
}

/**
 * Turn a stop's precomputed `directions` into a visible secondary line plus a
 * screen-reader label. Shows up to `maxPairs` pairs (already frequency-ordered
 * upstream, so truncation is correctness-safe per ADR-0008) and appends a
 * "+N more" suffix when there are more. Returns `null` when the stop has no
 * direction data, so the caller renders name-only.
 *
 * @param directions      frequency-ordered `(routeId, headsign)` pairs
 * @param resolveShortName maps a routeId to its human short name (via routes.json)
 * @param strings         visible/spoken string-builders (i18n at the call site)
 * @param maxPairs        how many pairs to show before truncating (default 2)
 */
export function formatDirections(
  directions: StopDirection[] | undefined,
  resolveShortName: (routeId: string) => string,
  strings: DirectionsLabelStrings,
  maxPairs = 2,
): DirectionsLabel | null {
  // Tolerate a missing array: `stops.json` is loaded without runtime validation
  // (ADR-era decision), so a bundle built before the `directions` field would
  // pass undefined here. Name-only fallback beats crashing the stop list.
  if (directions === undefined || directions.length === 0) return null;

  const shown = directions
    .slice(0, maxPairs)
    .map((d) => formatDirectionPair(resolveShortName(d.routeId), d.headsign, strings));
  const hiddenCount = directions.length - shown.length;

  const visibleParts = shown.map((p) => p.visible);
  const spokenParts = shown.map((p) => p.label);

  if (hiddenCount > 0) {
    visibleParts.push(strings.more(hiddenCount));
    spokenParts.push(strings.moreSpoken(hiddenCount));
  }

  return {
    visible: visibleParts.join(', '),
    label: spokenParts.join(', '),
  };
}
