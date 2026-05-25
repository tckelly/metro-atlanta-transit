/**
 * Pure stop-search functions used by both the per-route filter and
 * the global home-page search box.
 *
 * Ranking is a simple three-tier system — prefix > word-boundary >
 * anywhere — which covers the typed-prefix mobile pattern without a
 * fuzzy-match dependency. If real-world typo complaints arrive, the
 * pure shape here means swapping in fuse.js or a hand-rolled
 * Levenshtein later is a localized change with no consumer impact.
 *
 * The query is normalized (lowercased + trimmed) and any regex
 * metacharacters in it are escaped before use, so user input can't
 * inject patterns or cause catastrophic backtracking.
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
