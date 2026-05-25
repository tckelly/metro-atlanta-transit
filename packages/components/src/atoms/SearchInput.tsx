/**
 * Search input atom — controlled, with a magnifying-glass icon prefix
 * and an inline clear button that appears only when the field has a
 * value. No domain logic; consumers attach their own onChange handler
 * to drive filtering or fetch logic.
 *
 * ARIA labels (the visible-less `aria-label` for the input and the
 * `clearLabel` for the clear button) are caller-supplied so the
 * library stays i18n-agnostic — the web package passes translated
 * strings via `t()`.
 *
 * Touch target on the clear button is 44×44 to match Button's a11y
 * baseline. The input's `inputMode="search"` brings up the search
 * keyboard on mobile.
 */
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

import { Icon } from './Icon';

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (next: string) => void;
  /** Accessible name for the input. Required — there is no visible label. */
  'aria-label': string;
  /** Accessible name for the inline clear button. Required when it can appear. */
  clearLabel: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange, clearLabel, className, ...rest }, ref) {
    const hasValue = value !== '';
    return (
      <div
        className={[
          'relative flex items-center rounded-md border border-divider bg-surface-elevated focus-within:border-primary focus-within:ring-2 focus-within:ring-primary',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="pointer-events-none flex h-11 w-11 items-center justify-center text-fg-muted">
          <Icon name="search" />
        </span>
        <input
          {...rest}
          ref={ref}
          type="search"
          inputMode="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="min-h-[44px] flex-1 bg-transparent pr-2 text-base text-fg placeholder:text-fg-muted focus:outline-none"
        />
        {hasValue && (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => {
              onChange('');
            }}
            className="flex h-11 w-11 items-center justify-center text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="close" />
          </button>
        )}
      </div>
    );
  },
);
