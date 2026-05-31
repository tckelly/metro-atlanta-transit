/**
 * Interactive wrapper around a BusRow visual: tapping the row reveals
 * the downstream stops for that specific trip ("is my target stop on
 * this branch?"). Stays in the web/features layer so the components
 * library's `BusRow` atom remains pure visual (per ADR-0003).
 *
 * Data is supplied by the parent — the live-realtime path computes
 * the downstream stops in-memory and passes them eagerly; the
 * scheduled path uses `onOpen` as a lazy-fetch hook. The component
 * itself only owns open/close state and a11y wiring.
 */
import { useCallback, useId, useState } from 'react';
import { Icon, Skeleton, type BusRowProps } from '@atl-transit/components';

export interface DownstreamStopView {
  /** Unique key for React list rendering — typically the GTFS stop_id. */
  stopId: string;
  /** Display name shown to the rider, e.g. "Ponce @ Barnett". */
  name: string;
  /**
   * When true, the realtime feed indicates this trip will skip the
   * stop today (detour, construction, missed stop). Shown to the rider
   * with strikethrough + a "(skipped)" annotation.
   */
  isSkipped?: boolean;
  /**
   * Pre-formatted predicted arrival text (e.g. "12:34" or "3 min").
   * Live path only — the scheduled path leaves this undefined.
   */
  predictedArrivalText?: string;
}

export interface BusRowDisclosureProps {
  /** Visual props for the row itself — same shape BusRow consumes. */
  busRowProps: BusRowProps;
  /**
   * Downstream stops to render in the open panel. `undefined` means
   * "loading" (shows a skeleton); `[]` means "rider is at the last
   * stop on this trip" (shows the `lastStopLabel` message).
   */
  downstream: DownstreamStopView[] | undefined;
  /** Called on every open transition so the parent can lazy-fetch. */
  onOpen?: () => void;
  /** Full a11y label for the disclosure trigger button. */
  triggerLabel: string;
  /** A11y label for the expanded panel region. */
  panelLabel: string;
  /** A11y label for the loading status region. */
  loadingLabel?: string;
  /** Text shown when downstream is the empty array. */
  lastStopLabel?: string;
  /** Annotation appended to skipped stops. */
  skippedLabel?: string;
  /**
   * When set, the open panel renders this message instead of the
   * loading/list/last-stop content — used to signal that the
   * underlying fetch failed. Honest failure beats a success-looking
   * empty state that misleads the rider.
   */
  errorMessage?: string;
}

const PRIMARY_SEVERITY_CLASS: Record<BusRowProps['severity'], string> = {
  success: 'text-status-live',
  warning: 'text-status-warn',
  danger: 'text-status-cancelled',
  neutral: 'text-fg',
};

const ICON_SEVERITY_CLASS: Record<BusRowProps['severity'], string> = {
  success: 'text-status-live',
  warning: 'text-status-warn',
  danger: 'text-status-cancelled',
  neutral: 'text-fg-muted',
};

export function BusRowDisclosure({
  busRowProps,
  downstream,
  onOpen,
  triggerLabel,
  panelLabel,
  loadingLabel,
  lastStopLabel,
  skippedLabel,
  errorMessage,
}: BusRowDisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) onOpen?.();
      return next;
    });
  }, [onOpen]);

  const {
    icon,
    severity,
    primaryText,
    primaryStyle,
    secondaryText,
  } = busRowProps;
  const primaryStyleResolved = primaryStyle ?? 'normal';

  const primaryClass = [
    'text-2xl font-bold leading-tight',
    PRIMARY_SEVERITY_CLASS[severity],
    primaryStyleResolved === 'strikethrough' ? 'line-through' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={triggerLabel}
        onClick={handleToggle}
        className="flex w-full items-start gap-3 py-3 text-left"
      >
        {icon && (
          <span className={`mt-1 shrink-0 ${ICON_SEVERITY_CLASS[severity]}`}>
            <Icon name={icon} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className={primaryClass}>{primaryText}</div>
          {secondaryText && (
            <div className="mt-1 text-sm text-fg-muted">{secondaryText}</div>
          )}
        </div>
        <span className="ml-2 mt-1 shrink-0 text-fg-muted">
          <Icon name={open ? 'chevron-up' : 'chevron-down'} />
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={panelLabel}
          className="pb-3 pl-8 pr-3"
        >
          {errorMessage !== undefined ? (
            <p className="text-sm text-status-cancelled">{errorMessage}</p>
          ) : (
            <>
              {downstream === undefined && loadingLabel !== undefined && (
                <div role="status" aria-live="polite" aria-label={loadingLabel}>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-4 w-32" />
                </div>
              )}

              {downstream !== undefined &&
                downstream.length === 0 &&
                lastStopLabel !== undefined && (
                  <p className="text-sm text-fg-muted">{lastStopLabel}</p>
                )}

              {downstream !== undefined && downstream.length > 0 && (
                <ul className="space-y-1">
                  {downstream.map((s) => (
                    <li
                      key={s.stopId}
                      className="flex items-baseline gap-3 text-sm"
                    >
                      <span className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span
                          className={
                            s.isSkipped
                              ? 'text-fg-muted line-through'
                              : 'text-fg'
                          }
                        >
                          {s.name}
                        </span>
                        {s.isSkipped && skippedLabel !== undefined && (
                          <span className="text-fg-muted">
                            ({skippedLabel})
                          </span>
                        )}
                      </span>
                      {s.predictedArrivalText !== undefined ? (
                        <span className="shrink-0 tabular-nums text-fg-muted">
                          {s.predictedArrivalText}
                        </span>
                      ) : (
                        // NO_DATA from the realtime feed — bus still serves the
                        // stop, just no live prediction. Em-dash keeps the
                        // time column aligned and signals "no live time"
                        // without implying cancellation.
                        <span
                          aria-hidden="true"
                          className="shrink-0 tabular-nums text-fg-muted"
                        >
                          —
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
