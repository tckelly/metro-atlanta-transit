import gtfs from 'gtfs-realtime-bindings';

import { AlertsFeedSchema, type AlertsFeed } from './types';

const { FeedMessage } = gtfs.transit_realtime;

/**
 * Extract the first English translation from a GTFS-RT TranslatedString,
 * falling back to the first available translation. Returns undefined if
 * no translations are present or all are empty.
 *
 * MARTA currently publishes empty TranslatedString envelopes for some
 * fields (see data-and-apis.md finding #5); this helper returns
 * undefined in that case rather than an empty string.
 */
function extractText(ts: unknown): string | undefined {
  if (!ts || typeof ts !== 'object') return undefined;
  const translations = (ts as { translation?: Array<{ text?: string; language?: string }> })
    .translation;
  if (!translations || translations.length === 0) return undefined;

  const en = translations.find((t) => t.language === 'en' || t.language === undefined);
  const text = (en ?? translations[0])?.text;
  return text ? text : undefined;
}

/**
 * Decode a MARTA GTFS-Realtime alerts payload into our internal domain shape.
 *
 * As of the 2026-05-22 snapshot MARTA's alerts feed is empty. This decoder
 * still validates the header and returns an empty alerts array in that
 * case. When MARTA starts populating alerts, the same code path extracts
 * affected routes/stops and English-language text.
 */
export function decodeAlerts(bytes: Uint8Array): AlertsFeed {
  const message = FeedMessage.decode(bytes);
  const obj = FeedMessage.toObject(message, {
    enums: String,
    longs: Number,
    defaults: false,
  });

  const feedTimestamp = obj.header?.timestamp;
  if (typeof feedTimestamp !== 'number') {
    throw new Error('decodeAlerts: feed header.timestamp is missing or not numeric');
  }

  const alerts: unknown[] = [];

  for (const entity of obj.entity ?? []) {
    if (!entity.alert || !entity.id) continue;
    const alert = entity.alert;

    const affectedRouteIds: string[] = [];
    const affectedStopIds: string[] = [];
    for (const selector of alert.informedEntity ?? []) {
      if (selector.routeId) affectedRouteIds.push(selector.routeId);
      if (selector.stopId) affectedStopIds.push(selector.stopId);
    }

    const activePeriods = (alert.activePeriod ?? []).map((p: { start?: number; end?: number }) => ({
      start: p.start,
      end: p.end,
    }));

    alerts.push({
      id: entity.id,
      cause: alert.cause,
      effect: alert.effect,
      headerText: extractText(alert.headerText),
      descriptionText: extractText(alert.descriptionText),
      affectedRouteIds,
      affectedStopIds,
      activePeriods,
    });
  }

  return AlertsFeedSchema.parse({ feedTimestamp, alerts });
}
