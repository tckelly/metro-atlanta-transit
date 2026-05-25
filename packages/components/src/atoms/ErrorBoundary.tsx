/**
 * Catches errors thrown during render of any descendant, swaps to the
 * `fallback` UI, and lets the rest of the app keep working.
 *
 * Used at the route level (per CLAUDE.md's error-handling guidance) so
 * a broken page doesn't take down the whole app — the user can still
 * navigate elsewhere. Class component because React Error Boundaries
 * have no functional equivalent yet (as of React 19).
 *
 * `fallback` accepts either a static ReactNode or a function that
 * receives the caught Error — useful when the fallback wants to
 * surface error details ("Couldn't load: {message}").
 *
 * `resetKey` is the standard pattern for clearing the error on a
 * navigation: pass the current route pathname, and a navigation
 * causes the boundary to retry rendering the new tree.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

export type ErrorBoundaryFallback = ReactNode | ((error: Error) => ReactNode);

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ErrorBoundaryFallback;
  /** When this value changes between renders, the boundary clears its error state. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to console so whatever sink dev tooling / Sentry / etc.
    // is hooked to picks it up. Production should add a transport layer
    // here; v1 ships with browser console only.
    console.error('[ErrorBoundary] caught:', error, info.componentStack);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.setState({ error: null });
    }
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return typeof this.props.fallback === 'function'
      ? this.props.fallback(error)
      : this.props.fallback;
  }
}
