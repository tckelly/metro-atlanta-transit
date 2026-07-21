/**
 * "FIVE POINTS STATION" → "Five Points Station" for display.
 *
 * The realtime feed (and the URL param keyed on it) uses uppercase names;
 * title-casing reads better than GTFS's own abbreviated "Five Points Stn".
 * A canonical name arrives with the stopId registry (see docs/features/rail.md);
 * this is the non-breaking stepping stone, shared by the station-detail page
 * and the station directory.
 */
export function titleCaseStationName(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
