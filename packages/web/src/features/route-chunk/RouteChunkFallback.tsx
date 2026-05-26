/**
 * Suspense fallback shown while a lazy-loaded route chunk is being
 * downloaded by the browser.
 *
 * Two audiences, two priorities:
 *   - Screen-reader users hear the transition immediately via a
 *     polite live region (the text and aria-label are present from
 *     the first render).
 *   - Sighted users see nothing for the first ~250ms. Most route
 *     chunks resolve in well under that on a normal connection, so
 *     the transition stays flicker-free for the typical case. On
 *     slow connections (subway, weak cell), a quiet visible loader
 *     appears so the page doesn't look broken.
 *
 * The text content is identical in both states — flipping the class,
 * not the content. That keeps the SR announcement to a single event
 * per chunk load (aria-live re-announces on text changes).
 */
import { useTranslation } from 'react-i18next';

import { useDelayedFlag } from '../../utils/useDelayedFlag';

const REVEAL_DELAY_MS = 250;

export function RouteChunkFallback() {
  const { t } = useTranslation();
  const visible = useDelayedFlag(REVEAL_DELAY_MS);
  const label = t('loading.page');
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={
        visible ? 'flex items-center justify-center py-8 text-sm text-fg-muted' : 'sr-only'
      }
    >
      {label}
    </div>
  );
}
