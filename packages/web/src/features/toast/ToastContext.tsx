/**
 * Single-slot toast system.
 *
 * One toast at a time, replaced on subsequent `show()` calls. The
 * rendered region uses `role="status"` + `aria-live="polite"` so screen
 * readers announce confirmation and undo actions without interrupting.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

/**
 * 6 seconds — long enough to read a sentence and reach for the undo
 * button on a phone (~5s is the lower bound common in design systems;
 * the extra second buys read-and-act time for mobile users).
 */
export const TOAST_AUTO_DISMISS_MS = 6_000;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
}

interface ToastState {
  id: number;
  message: string;
  action?: ToastAction;
}

export interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextIdRef = useRef(1);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  const show = useCallback((message: string, options?: ToastOptions) => {
    const next: ToastState = { id: nextIdRef.current++, message };
    if (options?.action !== undefined) next.action = options.action;
    setToast(next);
  }, []);

  useEffect(() => {
    if (toast === null) return;
    const handle = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [toast]);

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast !== null && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-md bg-surface-elevated px-4 py-3 text-sm shadow-lg ring-1 ring-divider"
        >
          <span className="text-fg">{toast.message}</span>
          {toast.action !== undefined && (
            <button
              type="button"
              className="rounded px-2 py-1 text-sm font-semibold text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => {
                toast.action?.onClick();
                dismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast must be called inside a ToastProvider.');
  }
  return ctx;
}
