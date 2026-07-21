import type { RailArrivalDTO } from '../../services/martaRail';

export interface RailLineGroup {
  /** Line identity; maps to a color token at the web boundary (ADR-0003). */
  line: string;
  /** Cardinal direction (N/S/E/W), carried for the header / a11y. */
  direction: string;
  /** Terminus headsign — the grouping key alongside `line`. */
  destination: string;
  arrivals: RailArrivalDTO[];
}

/**
 * Group rail arrivals by (line, destination) — the rail analogue of the bus
 * `groupRowsByRoute`'s (route, headsign). Group order follows the first
 * appearance of each (line, destination) pair; arrivals within a group keep
 * their input order.
 *
 * The caller is expected to pre-sort `arrivals` by `arrivalTime` ascending
 * (as `useRailArrivals` does), so the group with the soonest train comes first
 * and rows stay time-ordered — the same contract `groupRowsByRoute` relies on
 * from the classifier's sort.
 *
 * Keyed on `destination` (the rail headsign equivalent) rather than the coarser
 * `direction` so a short-turn — same line and direction, different terminus —
 * is its own section a rider won't mistakenly board. See `docs/features/rail.md`.
 */
export function groupArrivalsByLineDestination(arrivals: RailArrivalDTO[]): RailLineGroup[] {
  const groups = new Map<string, RailLineGroup>();
  for (const arrival of arrivals) {
    // Tab separator: lines never contain one, so the key can't collide across
    // different (line, destination) pairs even though destinations have spaces.
    const key = `${arrival.line}\t${arrival.destination}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        line: arrival.line,
        direction: arrival.direction,
        destination: arrival.destination,
        arrivals: [],
      };
      groups.set(key, group);
    }
    group.arrivals.push(arrival);
  }
  return Array.from(groups.values());
}
