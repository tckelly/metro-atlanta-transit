/**
 * Off-screen `aria-live` region that announces freshness-tier
 * transitions to screen-reader users.
 *
 * The visible `LastUpdatedIndicator` re-renders every 15s as the
 * "X seconds ago" text bucket flips. Wiring `aria-live` directly on
 * that node would shout the timestamp at the user every 15 seconds —
 * polite by spec, irritating in practice. This component watches the
 * coarse `tier` prop instead and announces only the meaningful events:
 *
 *   fresh → stale          — "Couldn't refresh — data may be stale"
 *   stale → very_stale     — "Data may be wrong — couldn't refresh"
 *   (stale or very_stale) → fresh — "Arrivals refreshed"
 *
 * Mounts are silent regardless of tier — the user just opened the
 * page; the visible state already carries the cue for sighted users,
 * and the next real transition will land for screen readers.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FreshnessTier } from '../../utils/freshnessTier';

export interface LastUpdatedAnnouncementProps {
  tier: FreshnessTier;
}

export function LastUpdatedAnnouncement({ tier }: LastUpdatedAnnouncementProps) {
  const { t } = useTranslation();
  const previousTier = useRef<FreshnessTier | undefined>(undefined);
  const [message, setMessage] = useState('');

  // The setState-on-tier-transition is intentional — the message is
  // a derived stream of "things to say when state changes," not a
  // synchronous derivation of the current tier. A ref tracks the
  // last-rendered tier so we only fire on genuine transitions.
  useEffect(() => {
    const previous = previousTier.current;
    previousTier.current = tier;
    if (previous === undefined || previous === tier) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (tier === 'stale') {
      setMessage(t('stopDetail.staleAnnouncement'));
    } else if (tier === 'very_stale') {
      setMessage(t('stopDetail.veryStaleAnnouncement'));
    } else {
      setMessage(t('stopDetail.refreshedAnnouncement'));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [tier, t]);

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
