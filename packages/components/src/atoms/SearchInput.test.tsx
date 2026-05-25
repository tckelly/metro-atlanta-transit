/**
 * Behavior tests for the SearchInput atom.
 *
 * Scope: presentation + interaction. No domain logic — that lives in
 * `features/search/` in the web package.
 */
import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('renders an accessible input with the provided label and placeholder', () => {
    render(
      <SearchInput
        value=""
        onChange={() => {}}
        aria-label="Search stops"
        placeholder="Street or stop name"
        clearLabel="Clear search"
      />,
    );
    const input = screen.getByRole('searchbox', { name: 'Search stops' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Street or stop name');
  });

  it('calls onChange with the new value as the user types', async () => {
    const onChange = vi.fn();
    render(
      <SearchInput
        value=""
        onChange={onChange}
        aria-label="Search stops"
        clearLabel="Clear search"
      />,
    );
    await userEvent.type(screen.getByRole('searchbox'), 'p');
    expect(onChange).toHaveBeenCalledWith('p');
  });

  it('hides the clear button when the value is empty', () => {
    render(
      <SearchInput
        value=""
        onChange={() => {}}
        aria-label="Search stops"
        clearLabel="Clear search"
      />,
    );
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('shows the clear button when the value is non-empty', () => {
    render(
      <SearchInput
        value="ponce"
        onChange={() => {}}
        aria-label="Search stops"
        clearLabel="Clear search"
      />,
    );
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('clicking the clear button calls onChange with an empty string', async () => {
    const onChange = vi.fn();
    render(
      <SearchInput
        value="ponce"
        onChange={onChange}
        aria-label="Search stops"
        clearLabel="Clear search"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('forwards a ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <SearchInput
        ref={ref}
        value=""
        onChange={() => {}}
        aria-label="Search stops"
        clearLabel="Clear search"
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
