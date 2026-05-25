/**
 * Single-slot toast orchestration.
 *
 * One toast at a time, replaced on subsequent `show()` calls. The
 * visual molecule lives in `@atl-transit/components`; this provider
 * owns the state machine (current toast, auto-dismiss timer) and wraps
 * each action's onClick with the dismiss call.
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
import { Toast } from '@atl-transit/components';

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
    return () => { clearTimeout(handle); };
  }, [toast]);

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast !== null && (
        <Toast
          message={toast.message}
          {...(toast.action !== undefined
            ? {
                action: {
                  label: toast.action.label,
                  onClick: () => {
                    toast.action?.onClick();
                    dismiss();
                  },
                },
              }
            : {})}
        />
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
