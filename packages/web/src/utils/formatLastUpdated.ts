/**
 * Format the age of a timestamp as a human-readable phrase for the
 * "Last updated …" indicator on the stop detail page.
 *
 * Buckets:
 * - 0–4s    → "now"
 * - 5–59s   → "5 seconds ago" / "10 seconds ago" / … / "55 seconds ago"
 *             (floored to the nearest 5 so the text changes visibly
 *              each page tick — `useNowSec(5_000)` in StopDetail)
 * - 60s+    → "X min ago"
 */

const NOW_THRESHOLD_SEC = 5;
const MINUTE_SEC = 60;
const SECOND_BUCKET_SEC = 5;

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
