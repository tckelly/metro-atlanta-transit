/**
 * Toggle a stop in/out of the user's favorites, with an undo toast.
 *
 * Uses the visible stop name in both the accessible label and the toast
 * message so screen-reader users and sighted users get the same answer
 * ("Removed Virginia Ave"), and so undo never strands an unlabeled action
 * referring to a stop the user can't see anymore.
 */
import { Icon } from '@atl-transit/components';

import { useFavorites } from './FavoritesContext';
import { useToast } from '../toast/ToastContext';

export interface FavoriteStarButtonProps {
  stopId: string;
  stopName: string;
}

export function FavoriteStarButton({ stopId, stopName }: FavoriteStarButtonProps) {
  const { has, add, remove, isFull } = useFavorites();
  const { show } = useToast();
  const favorited = has(stopId);

  const handleClick = () => {
    if (favorited) {
      remove(stopId);
      show(`Removed ${stopName}`, {
        action: { label: 'Undo', onClick: () => add(stopId) },
      });
      return;
    }
    if (isFull) {
      show(`Favorites full (max 10). Remove one to add a new stop.`);
      return;
    }
    add(stopId);
    show(`Added ${stopName}`, {
      action: { label: 'Undo', onClick: () => remove(stopId) },
    });
  };

  const label = favorited
    ? `Remove ${stopName} from favorites`
    : `Add ${stopName} to favorites`;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-pressed={favorited}
      // 44px hit target keeps WCAG 2.2 target-size compliance on a phone;
      // the star sits inside it visually.
      className={`inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        favorited ? 'text-status-warn' : 'text-fg-muted'
      }`}
    >
      <Icon name={favorited ? 'star-filled' : 'star'} />
    </button>
  );
}
