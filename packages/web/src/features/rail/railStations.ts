import type { RailArrivalDTO } from '../../services/martaRail';
import { titleCaseStationName } from './stationName';

export interface RailStation {
  /** Raw feed station name — the key the station-detail page filters on and links to. */
  name: string;
  /** Title-cased name for display. */
  displayName: string;
  /** Distinct lines serving the station, in canonical order. */
  lines: string[];
}

/** Canonical MARTA line order for consistent display. */
const LINE_ORDER = ['RED', 'GOLD', 'BLUE', 'GREEN'];

function lineRank(line: string): number {
  const i = LINE_ORDER.indexOf(line);
  return i === -1 ? LINE_ORDER.length : i;
}

/**
 * Derive the rail station directory from a snapshot of arrivals — the feed is
 * the authoritative station list, and keying on its names guarantees every
 * `/station/:name` link resolves (unlike the static-GTFS names, which drift for
 * ~6 stations; see docs/features/rail.md). Stations are sorted alphabetically;
 * each carries the distinct lines that serve it, in canonical order.
 */
export function railStationsFromArrivals(arrivals: RailArrivalDTO[]): RailStation[] {
  const linesByStation = new Map<string, Set<string>>();
  for (const arrival of arrivals) {
    let lines = linesByStation.get(arrival.station);
    if (!lines) {
      lines = new Set();
      linesByStation.set(arrival.station, lines);
    }
    lines.add(arrival.line);
  }

  const stations: RailStation[] = [];
  for (const [name, lineSet] of linesByStation) {
    const lines = [...lineSet].sort((a, b) => lineRank(a) - lineRank(b) || a.localeCompare(b));
    stations.push({ name, displayName: titleCaseStationName(name), lines });
  }

  return stations.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
