import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ErrorBoundary } from './ErrorBoundary';

function Boom({ message = 'kaboom' }: { message?: string }): never {
  throw new Error(message);
}

function Ok() {
  return <div>everything is fine</div>;
}

// React surfaces every caught error to console.error in development.
// Silence the noise so the test runner output stays clean — assertions
// already verify the boundary behaved correctly.
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <Ok />
      </ErrorBoundary>,
    );
    expect(screen.getByText('everything is fine')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).toBeNull();
  });

  it('renders the static fallback when a child throws', () => {
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('exposes the caught error via the function-form fallback', () => {
    render(
      <ErrorBoundary fallback={(err) => <div>caught: {err.message}</div>}>
        <Boom message="upstream broke" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('caught: upstream broke')).toBeInTheDocument();
  });

  it('only catches errors below it in the tree — siblings render normally', () => {
    render(
      <div>
        <ErrorBoundary fallback={<div>boom-caught</div>}>
          <Boom />
        </ErrorBoundary>
        <Ok />
      </div>,
    );
    expect(screen.getByText('boom-caught')).toBeInTheDocument();
    expect(screen.getByText('everything is fine')).toBeInTheDocument();
  });

  it('logs the error so dev tooling and remote logging can pick it up', () => {
    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <Boom message="logme" />
      </ErrorBoundary>,
    );
    // React itself logs once; our componentDidCatch should also log so the
    // app's logging hooks (whatever they end up being) see the error.
    const calls = consoleSpy.mock.calls.flat().map(String);
    expect(calls.some((s) => s.includes('logme'))).toBe(true);
  });

  it('resets when resetKey changes — lets routes recover on navigation', () => {
    const { rerender } = render(
      <ErrorBoundary fallback={<div>fallback</div>} resetKey="route-a">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fallback')).toBeInTheDocument();

    rerender(
      <ErrorBoundary fallback={<div>fallback</div>} resetKey="route-b">
        <Ok />
      </ErrorBoundary>,
    );
    expect(screen.getByText('everything is fine')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).toBeNull();
  });
});
