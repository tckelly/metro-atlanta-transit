/**
 * Cold-open loading view shown inside `BundleGate` while the small
 * GTFS bundle (`/gtfs/stops.json` + `/gtfs/routes.json`) loads on
 * first-ever app open. Replaces the previous text-only `MessageCard`
 * so the user immediately sees the app brand and a content shape
 * instead of a centered "One moment." card.
 *
 * Loading-only, not persistent app chrome. The trade-offs behind that
 * choice are written up in `docs/launch-checklist.md` § "Cold-open
 * loading state" — short version: a transit user opens Settings rarely
 * and wants every row of vertical space for content, so we don't pay
 * for cold-open polish with permanent header chrome on every screen.
 *
 * Brand text is a `<span>`, not an `<h1>` — `ux-guidelines.md` reserves
 * h1 for the page that mounts after load (stop name, route name, etc.).
 * The skeleton bars are `aria-hidden` (Skeleton handles that); the
 * surrounding `role="status"` live region carries the announcement.
 */
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@atl-transit/components';

export function LoadingShell() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <span className="block text-3xl font-bold">{t('app.name')}</span>
        <p className="mt-1 text-sm text-fg-muted">{t('app.tagline')}</p>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-label={t('bundle.loadingTitle')}
        className="space-y-4"
      >
        <Skeleton className="h-11 w-full" />
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Skeleton className="h-20 w-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
