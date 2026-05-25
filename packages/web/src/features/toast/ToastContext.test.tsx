import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { ToastProvider, useToast, TOAST_AUTO_DISMISS_MS } from './ToastContext';

let actionSpy: ReturnType<typeof vi.fn>;

function Probe({ children }: { children?: ReactNode }) {
  const { show, dismiss } = useToast();
  return (
    <div>
      <button onClick={() => show('Removed Virginia Ave')}>show simple</button>
      <button
        onClick={() =>
          show('Removed Virginia Ave', {
            action: { label: 'Undo', onClick: () => actionSpy() },
          })
        }
      >
        show with undo
      </button>
      <button onClick={dismiss}>dismiss</button>
      {children}
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );
}

beforeEach(() => {
  actionSpy = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('renders nothing until a toast is shown', () => {
    renderWithProvider();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('show() renders the message in a polite live region', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText('show simple'));

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Removed Virginia Ave');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders an action button when an action is provided', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText('show with undo'));

    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('invokes the action callback and dismisses on click', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText('show with undo'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(actionSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('replaces a prior toast when show() is called again', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText('show simple'));
    await user.click(screen.getByText('show with undo'));

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('dismiss() removes the current toast', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByText('show simple'));
    await user.click(screen.getByText('dismiss'));

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('auto-dismisses after TOAST_AUTO_DISMISS_MS', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });

    act(() => {
      result.current.show('Removed Virginia Ave');
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not auto-dismiss before the timeout', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });

    act(() => {
      result.current.show('Removed Virginia Ave');
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS - 100);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('useToast throws outside ToastProvider', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ToastProvider/);
    errSpy.mockRestore();
  });
});
