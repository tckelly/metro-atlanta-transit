/**
 * Thresholds for the route-disruption indicator.
 *
 * Centralized so the heuristic is one edit away when real-world data
 * tells us the cutoffs are off. See M4 in docs/roadmap.md and the
 * follow-up in the "first two weeks post-launch" plan.
 */

/** A single cancellation in the next few trips triggers the soft warning. */
export const SOFT_DISRUPTION_THRESHOLD = 1;

/** Two or more cancellations escalate to the strong warning. */
export const STRONG_DISRUPTION_THRESHOLD = 2;

export type DisruptionLevel = 'none' | 'soft' | 'strong';
