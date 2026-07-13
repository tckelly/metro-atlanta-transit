import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

const statusText = cva('', {
  variants: {
    severity: {
      success: 'text-status-live',
      warning: 'text-status-warn',
      danger: 'text-status-cancelled',
      neutral: 'text-fg',
    },
    weight: {
      normal: '',
      semibold: 'font-semibold',
    },
  },
  defaultVariants: { severity: 'neutral', weight: 'normal' },
});

export interface StatusTextProps extends VariantProps<typeof statusText> {
  severity: NonNullable<VariantProps<typeof statusText>['severity']>;
  children: ReactNode;
}

/**
 * Inline text tinted by a visual severity — the single home for the
 * `severity → text-status-*` mapping that was duplicated across the stop
 * surfaces (FavoriteStopCard, BusRowDisclosure, StopDetail) before ADR-0009.
 *
 * Visual-semantic props only (ADR-0003): the consumer maps its domain status
 * (live / delayed / cancelled, or fresh / stale / very-stale) to a severity.
 * Layout concerns like `whitespace-nowrap` stay with the consumer.
 */
export function StatusText({ severity, weight, children }: StatusTextProps) {
  return <span className={statusText({ severity, weight })}>{children}</span>;
}
