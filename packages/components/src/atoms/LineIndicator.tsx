import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

const swatch = cva('inline-block h-2.5 w-2.5 shrink-0 rounded-full', {
  variants: {
    line: {
      red: 'bg-line-red',
      gold: 'bg-line-gold',
      blue: 'bg-line-blue',
      green: 'bg-line-green',
      neutral: 'bg-fg-muted',
    },
  },
  defaultVariants: { line: 'neutral' },
});

export interface LineIndicatorProps extends VariantProps<typeof swatch> {
  /**
   * Visual-semantic line color (ADR-0003) — NOT a domain line value. The
   * consumer maps its domain line (e.g. MARTA `LINE: "RED"`) to this token,
   * falling back to `neutral` for an unrecognized line.
   */
  line: NonNullable<VariantProps<typeof swatch>['line']>;
  /** The line-name label, already localized by the consumer. Required by design. */
  children: ReactNode;
}

/**
 * A colored dot naming a rail line, paired with its name.
 *
 * The color is redundant reinforcement, never the sole signal — essential for
 * the Red/Green colour-vision-deficiency pair. The atom therefore renders the
 * swatch and label together and marks the swatch `aria-hidden`, so a screen
 * reader announces only the (required) label. Colors come from `line-*` brand
 * tokens (CLAUDE.md: semantic tokens, never raw Tailwind palette).
 */
export function LineIndicator({ line, children }: LineIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={swatch({ line })} />
      <span>{children}</span>
    </span>
  );
}
