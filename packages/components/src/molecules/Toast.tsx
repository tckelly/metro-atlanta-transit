/**
 * Single-toast visual molecule — message + optional inline action.
 *
 * Pure visual: no state, no auto-dismiss, no stacking. The consumer
 * (`web`'s ToastProvider) owns when the toast appears, when it goes
 * away, and what the action does after firing — typically dismissing
 * the toast. Keeping that orchestration outside the molecule lets the
 * design system stay framework-state-free.
 *
 * Rendered into a polite live region so screen readers announce the
 * change without interrupting whatever the user is doing. The action
 * button honors WCAG 2.5.5 with a 44px min tap target — the toast pill
 * grows to fit.
 */
import type { ReactNode } from 'react';

export interface ToastAction {
  label: ReactNode;
  onClick: () => void;
}

export interface ToastProps {
  message: ReactNode;
  action?: ToastAction;
}

export function Toast({ message, action }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-md bg-surface-elevated px-4 py-3 text-sm shadow-lg ring-1 ring-divider"
    >
      <span className="text-fg">{message}</span>
      {action !== undefined && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex min-h-[44px] items-center rounded px-3 text-sm font-semibold text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
