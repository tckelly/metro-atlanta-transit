/**
 * Three-tier freshness signal for the "Last updated …" indicator on
 * stop detail. See `docs/ux-guidelines.md` → "Last updated" indicator.
 *
 * - `fresh`      — refresh is healthy; muted color.
 * - `stale`      — refresh has failed but data is still under 5 minutes old; warn color.
 * - `very_stale` — refresh has failed and data is 5 minutes or older; danger color +
 *                  banner offering manual refresh.
 */
export type FreshnessTier = 'fresh' | 'stale' | 'very_stale';

export interface FreshnessInput {
  lastUpdatedSec: number;
  isStale: boolean;
  nowSec: number;
}

const VERY_STALE_THRESHOLD_SEC = 5 * 60;

export function freshnessTier(input: FreshnessInput): FreshnessTier {
  if (!input.isStale) return 'fresh';
  const ageSec = Math.max(0, input.nowSec - input.lastUpdatedSec);
  return ageSec >= VERY_STALE_THRESHOLD_SEC ? 'very_stale' : 'stale';
}
