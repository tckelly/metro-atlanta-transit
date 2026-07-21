import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCard } from '@atl-transit/components';

import { StationDetailView } from '../features/rail/StationDetailView';
import { useRailArrivals } from '../features/rail/useRailArrivals';
import { groupArrivalsByLineDestination } from '../features/rail/groupArrivalsByLineDestination';
import { titleCaseStationName } from '../features/rail/stationName';
import { useFormatTime } from '../i18n/formatters';
import { useNowSec } from '../utils/useNowSec';

/**
 * Route container for a rail station's real-time arrivals. Reads the station
 * name from the URL, drives `useRailArrivals`, groups by line+destination, and
 * hands presentation to `StationDetailView`. Keeps the smart/dumb split: this
 * owns data + context (settings-aware `formatTime`), the View owns rendering.
 */
export function StationDetail() {
  const { t } = useTranslation();
  const { stationName } = useParams<{ stationName: string }>();

  if (!stationName) {
    return (
      <MessageCard
        title={t('rail.stationDetail.noStationTitle')}
        body={t('rail.stationDetail.noStationBody')}
      />
    );
  }
  return <StationDetailReady stationName={stationName} />;
}

function StationDetailReady({ stationName }: { stationName: string }) {
  const { status, arrivals, lastUpdated, isStale, error, refresh } = useRailArrivals(stationName);
  // Tick every 15s so ETA countdowns and "last updated" advance between polls.
  const nowSec = useNowSec(15_000);
  const formatTime = useFormatTime();
  const groups = groupArrivalsByLineDestination(arrivals);

  return (
    <StationDetailView
      stationName={titleCaseStationName(stationName)}
      status={status}
      groups={groups}
      lastUpdated={lastUpdated}
      isStale={isStale}
      error={error}
      onRefresh={() => {
        void refresh();
      }}
      nowSec={nowSec}
      formatTime={formatTime}
    />
  );
}
