import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

const badge = cva(
  'inline-flex items-center rounded px-2 py-0.5 text-sm font-medium',
  {
    variants: {
      severity: {
        success: 'bg-status-live/10 text-status-live',
        warning: 'bg-status-warn/10 text-status-warn',
        danger: 'bg-status-cancelled/10 text-status-cancelled',
        neutral: 'bg-surface-elevated text-fg-muted',
      },
    },
    defaultVariants: { severity: 'neutral' },
  },
);

export interface BadgeProps extends VariantProps<typeof badge> {
  children: ReactNode;
}

export function Badge({ severity, children }: BadgeProps) {
  return <span className={badge({ severity })}>{children}</span>;
}
