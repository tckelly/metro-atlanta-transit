/**
 * Format the age of a timestamp as a human-readable phrase for the
 * "Last updated …" indicator on the stop detail page.
 *
 * Buckets:
 * - 0–14s   → "now"
 * - 15–59s  → "15 seconds ago" / "30 seconds ago" / "45 seconds ago"
 *             (floored to the nearest 15 so the text changes visibly
 *              as the page tick advances — `useNowSec(15_000)` in
 *              StopDetail)
 * - 60s+    → "X min ago"
 */

const NOW_THRESHOLD_SEC = 15;
const MINUTE_SEC = 60;
const SECOND_BUCKET_SEC = 15;

export function formatLastUpdated(lastUpdatedSec: number, nowSec: number): string {
  const ageSec = Math.max(0, nowSec - lastUpdatedSec);
  if (ageSec < NOW_THRESHOLD_SEC) return 'now';
  if (ageSec < MINUTE_SEC) {
    const rounded = Math.floor(ageSec / SECOND_BUCKET_SEC) * SECOND_BUCKET_SEC;
    return `${rounded} seconds ago`;
  }
  const minutes = Math.round(ageSec / MINUTE_SEC);
  return `${minutes} min ago`;
}
