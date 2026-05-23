import { cva, type VariantProps } from 'class-variance-authority';

import { Icon, type IconName } from '../atoms/Icon';

const primaryStyles = cva('text-2xl font-bold leading-tight', {
  variants: {
    severity: {
      success: 'text-status-live',
      warning: 'text-status-warn',
      danger: 'text-status-cancelled',
      neutral: 'text-fg',
    },
    primaryStyle: {
      normal: '',
      strikethrough: 'line-through',
    },
  },
  defaultVariants: { severity: 'neutral', primaryStyle: 'normal' },
});

const iconWrapper = cva('mt-1 shrink-0', {
  variants: {
    severity: {
      success: 'text-status-live',
      warning: 'text-status-warn',
      danger: 'text-status-cancelled',
      neutral: 'text-fg-muted',
    },
  },
  defaultVariants: { severity: 'neutral' },
});

export interface BusRowProps extends VariantProps<typeof primaryStyles> {
  /**
   * The headline value the user sees first — an ETA ("3 min"), a status
   * word ("Cancelled"), or a scheduled time ("12:34"). Large type.
   */
  primaryText: string;

  /**
   * Smaller second line for context — scheduled time, delay, occupancy.
   * Omit entirely when there's nothing to add.
   */
  secondaryText?: string;

  severity: NonNullable<VariantProps<typeof primaryStyles>['severity']>;

  /** Optional leading icon — typically `clock` for live/no-data, `warning` for cancelled. */
  icon?: IconName;
}

/**
 * A single bus's row in a stop-detail list. Renders as an `<li>` — the parent
 * is expected to wrap a set of these in `<ul>` so screen readers announce
 * "list, N items."
 *
 * Visual-semantic props only (per ADR-0003): the consumer maps domain
 * status (live / cancelled / no_live_data) to severity + primaryStyle + icon.
 * See `packages/web/src/features/stops/busRowMapper.ts`.
 */
export function BusRow({
  primaryText,
  primaryStyle = 'normal',
  secondaryText,
  severity,
  icon,
}: BusRowProps) {
  return (
    <li className="flex gap-3 py-3">
      {icon && (
        <span className={iconWrapper({ severity })}>
          <Icon name={icon} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className={primaryStyles({ severity, primaryStyle })}>{primaryText}</div>
        {secondaryText && <div className="mt-1 text-sm text-fg-muted">{secondaryText}</div>}
      </div>
    </li>
  );
}
