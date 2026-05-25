/**
 * Toggle a stop in/out of the user's favorites, with an undo toast.
 *
 * Uses the visible stop name in both the accessible label and the toast
 * message so screen-reader users and sighted users get the same answer
 * ("Removed Virginia Ave"), and so undo never strands an unlabeled action
 * referring to a stop the user can't see anymore.
 */
import { Button, Icon } from '@atl-transit/components';

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
    <Button
      variant="icon"
      onClick={handleClick}
      aria-label={label}
      aria-pressed={favorited}
      className={favorited ? 'text-status-warn' : 'text-fg-muted'}
    >
      <Icon name={favorited ? 'star-filled' : 'star'} />
    </Button>
  );
}
