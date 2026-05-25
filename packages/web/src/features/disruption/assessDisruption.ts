/**
 * Map a list of classified bus rows for a single route at a stop to a
 * three-level disruption signal. Pure and synchronous; the visual badge
 * decides what each level looks like.
 *
 * Only `cancelled` rows count toward the threshold — `no_live_data` is
 * ambiguous (could be a bus running fine that just isn't reporting) and
 * we don't want a quiet feed to look like a disruption.
 */
import type { ClassifiedBusRow } from '../stops/busRowClassifier';
import {
  SOFT_DISRUPTION_THRESHOLD,
  STRONG_DISRUPTION_THRESHOLD,
  type DisruptionLevel,
} from './thresholds';

export function assessDisruption(rows: ClassifiedBusRow[]): DisruptionLevel {
  const cancellations = rows.reduce(
    (count, row) => (row.status === 'cancelled' ? count + 1 : count),
    0,
  );
  if (cancellations >= STRONG_DISRUPTION_THRESHOLD) return 'strong';
  if (cancellations >= SOFT_DISRUPTION_THRESHOLD) return 'soft';
  return 'none';
}
