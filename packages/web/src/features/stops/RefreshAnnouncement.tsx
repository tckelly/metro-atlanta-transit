/**
 * Off-screen `aria-live` region that announces user-initiated
 * refreshes. The integration in `StopDetail` sets `active = true`
 * for the lifetime of a button-triggered or PTR-triggered fetch and
 * back to `false` when it resolves.
 *
 * Auto-poll refreshes (the silent 30s timer) deliberately do NOT
 * flip `active` — they're not user-initiated and don't deserve an
 * announcement. Otherwise screen-reader users would hear "Refreshing
 * arrivals" twice a minute for as long as the page is open.
 */
import { useTranslation } from 'react-i18next';

export interface RefreshAnnouncementProps {
  active: boolean;
}

export function RefreshAnnouncement({ active }: RefreshAnnouncementProps) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {active ? t('stopDetail.refreshAnnouncement') : ''}
    </div>
  );
}
