/**
 * Pure search-matching primitives shared by every filter/search box
 * in the app — the all-routes filter, the per-route stop filter, and
 * the global home-page stop search.
 *
 * Two exports, layered:
 *   - `matchesQuery` — boolean predicate. Used by the in-place
 *     filters (Routes, RouteDetail) where preserving the page's
 *     sort order matters more than ranking.
 *   - `rankStops` — adds prefix > word-boundary > anywhere tiering
 *     and a result limit on top of `matchesQuery`. Used by the
 *     global stop search where there is no inherent order to keep
 *     and "best match first" is what the user expects.
 *
 * The query is normalized (lowercased + trimmed) and any regex
 * metacharacters in it are escaped before use, so user input can't
 * inject patterns or cause catastrophic backtracking. If real-world
 * typo complaints arrive, swap the implementation here for fuse.js
 * or a hand-rolled Levenshtein — consumers won't notice.
 *
 * @threat-model
 * @mitigates SearchModule against RegexInjection with escapeRegex on user-supplied query
 */
import type { StopOut } from '../../buildtime/preprocessGtfs';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns true when `query` is a (case-insensitive, whitespace-tolerant)
 * substring of `name`. Empty/whitespace queries always return false —
 * the caller decides what an empty input means for its UI (typically
 * "show the default content," not "match everything").
 */
export function matchesQuery(name: string, query: string): boolean {
  const q = normalize(query);
  if (q === '') return false;
  return name.toLowerCase().includes(q);
}

type Tier = 0 | 1 | 2; // 0=prefix, 1=word-boundary, 2=anywhere

function tierOf(name: string, normalizedQuery: string): Tier | null {
  const n = name.toLowerCase();
  if (n.startsWith(normalizedQuery)) return 0;
  // `\b` treats `@`, spaces, slashes etc. as word boundaries, so this
  // catches the second street in MARTA's "<street> @ <cross-street>"
  // intersection naming.
  const wb = new RegExp(`\\b${escapeRegex(normalizedQuery)}`);
  if (wb.test(n)) return 1;
  if (n.includes(normalizedQuery)) return 2;
  return null;
}

/**
 * Rank stops against `query`, returning at most `limit` results.
 * Within the same tier, source order is preserved so keyboard nav
 * over results is deterministic across renders.
 */
export function rankStops(
  stops: readonly StopOut[],
  query: string,
  limit: number,
): StopOut[] {
  const q = normalize(query);
  if (q === '') return [];

  const scored: Array<{ stop: StopOut; tier: Tier; index: number }> = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (stop === undefined) continue;
    const tier = tierOf(stop.name, q);
    if (tier !== null) scored.push({ stop, tier, index: i });
  }
  scored.sort((a, b) => a.tier - b.tier || a.index - b.index);
  return scored.slice(0, limit).map((s) => s.stop);
}
