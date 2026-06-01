/**
 * The current GTFS service date in MARTA's local timezone, formatted
 * as "YYYYMMDD". Shared by every consumer that anchors a static-GTFS
 * query — `useArrivals` (scheduled visits) and the stop-detail
 * disclosure (downstream stops) — so they agree on what "today"
 * means even when wall-clock UTC and Atlanta diverge.
 *
 * en-CA gives ISO-shaped output ("YYYY-MM-DD"); we strip the dashes
 * to match GTFS's date format.
 */
export function todayServiceDate(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()).replace(/-/g, '');
}
