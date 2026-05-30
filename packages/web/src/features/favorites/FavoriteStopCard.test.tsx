/**
 * Tests for `FavoriteStopCard`'s browse-vs-reorder mode contract.
 *
 * Browse mode (default): the whole card is a navigation link to the stop
 * detail page, with a passive `›` chevron in the right slot.
 *
 * Reorder mode: the card stops being a link (no navigation), the right
 * slot swaps to a vertical `↑`/`↓` button pair whose accessible labels
 * carry the stop identity so a screen-reader user knows *which* stop
 * they're about to move. Disabled-at-the-ends is driven by props from
 * the parent (which knows the list and the position), not by the card.
 *
 * Live-region announcement and the toggle live in `Home`; this file only
 * proves the per-card mode swap.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';

import { FavoriteStopCard } from './FavoriteStopCard';
import { renderForA11y } from '../../test-utils/a11y';

const STOP_ID = '902990';
const STOP_NAME = 'Virginia Ave @ Todd Rd';

describe('FavoriteStopCard', () => {
  describe('browse mode (default)', () => {
    it('wraps the card in a link to the stop detail page', () => {
      const { container } = renderForA11y(<FavoriteStopCard stopId={STOP_ID} />);
      const link = container.querySelector(`a[href="/stop/${STOP_ID}"]`);
      expect(link).not.toBeNull();
      expect(link?.textContent).toContain(STOP_NAME);
    });

    it('does not render move buttons', () => {
      const { queryByRole } = renderForA11y(<FavoriteStopCard stopId={STOP_ID} />);
      expect(queryByRole('button', { name: /move .* up/i })).toBeNull();
      expect(queryByRole('button', { name: /move .* down/i })).toBeNull();
    });
  });

  describe('reorder mode', () => {
    it('does not wrap the card in a link', () => {
      const { container } = renderForA11y(
        <FavoriteStopCard
          stopId={STOP_ID}
          mode="reorder"
          canMoveUp
          canMoveDown
          onMove={() => {}}
        />,
      );
      expect(container.querySelector(`a[href="/stop/${STOP_ID}"]`)).toBeNull();
    });

    it('renders move-up and move-down buttons with the stop name in their labels', () => {
      const { getByRole } = renderForA11y(
        <FavoriteStopCard
          stopId={STOP_ID}
          mode="reorder"
          canMoveUp
          canMoveDown
          onMove={() => {}}
        />,
      );
      expect(getByRole('button', { name: `Move ${STOP_NAME} up` })).toBeInTheDocument();
      expect(getByRole('button', { name: `Move ${STOP_NAME} down` })).toBeInTheDocument();
    });

    it('calls onMove("up") when the up button is clicked', () => {
      const onMove = vi.fn();
      const { getByRole } = renderForA11y(
        <FavoriteStopCard
          stopId={STOP_ID}
          mode="reorder"
          canMoveUp
          canMoveDown
          onMove={onMove}
        />,
      );
      fireEvent.click(getByRole('button', { name: `Move ${STOP_NAME} up` }));
      expect(onMove).toHaveBeenCalledWith('up');
    });

    it('calls onMove("down") when the down button is clicked', () => {
      const onMove = vi.fn();
      const { getByRole } = renderForA11y(
        <FavoriteStopCard
          stopId={STOP_ID}
          mode="reorder"
          canMoveUp
          canMoveDown
          onMove={onMove}
        />,
      );
      fireEvent.click(getByRole('button', { name: `Move ${STOP_NAME} down` }));
      expect(onMove).toHaveBeenCalledWith('down');
    });

    it('disables the up button when canMoveUp is false', () => {
      const { getByRole } = renderForA11y(
        <FavoriteStopCard
          stopId={STOP_ID}
          mode="reorder"
          canMoveUp={false}
          canMoveDown
          onMove={() => {}}
        />,
      );
      expect(getByRole('button', { name: `Move ${STOP_NAME} up` })).toBeDisabled();
      expect(getByRole('button', { name: `Move ${STOP_NAME} down` })).not.toBeDisabled();
    });

    it('disables the down button when canMoveDown is false', () => {
      const { getByRole } = renderForA11y(
        <FavoriteStopCard
          stopId={STOP_ID}
          mode="reorder"
          canMoveUp
          canMoveDown={false}
          onMove={() => {}}
        />,
      );
      expect(getByRole('button', { name: `Move ${STOP_NAME} down` })).toBeDisabled();
      expect(getByRole('button', { name: `Move ${STOP_NAME} up` })).not.toBeDisabled();
    });
  });
});
