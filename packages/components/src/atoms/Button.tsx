/**
 * The single button atom for the app.
 *
 * Three variants cover every real call site today: `primary` (outline,
 * the headline CTA), `neutral` (outline, secondary actions like Refresh
 * or Retry), and `icon` (44×44 square — color comes from the caller
 * because icon meaning is state-dependent, like a star toggle).
 *
 * Tap-target sizing (44px min) and the focus-visible ring are baked in
 * so accessibility is the default — callers can't opt out by forgetting.
 *
 * Caller-supplied `className` is appended so domain wrappers can layer
 * state-dependent tone (e.g., `text-status-warn` on a favorited star)
 * without redefining the base style.
 */
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

const button = cva(
  'inline-flex items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'min-h-[44px] border border-primary px-4 text-sm font-semibold text-primary hover:bg-surface',
        neutral:
          'min-h-[44px] border border-divider px-4 text-sm font-medium text-fg hover:bg-surface-elevated',
        icon: 'h-11 w-11 hover:bg-surface-elevated',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, className, type = 'button', children, ...rest },
  ref,
) {
  const merged = [button({ variant }), className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={merged} {...rest}>
      {children}
    </button>
  );
});
