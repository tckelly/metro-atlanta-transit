/**
 * Toggle a stop in/out of the user's favorites, with an undo toast.
 *
 * Uses the visible stop name in both the accessible label and the toast
 * message so screen-reader users and sighted users get the same answer
 * ("Removed Virginia Ave"), and so undo never strands an unlabeled action
 * referring to a stop the user can't see anymore.
 */
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@atl-transit/components';

import { useFavorites } from './FavoritesContext';
import { useToast } from '../toast/ToastContext';

export interface FavoriteStarButtonProps {
  stopId: string;
  stopName: string;
}

export function FavoriteStarButton({ stopId, stopName }: FavoriteStarButtonProps) {
  const { t } = useTranslation();
  const { has, add, remove, isFull } = useFavorites();
  const { show } = useToast();
  const favorited = has(stopId);

  const handleClick = () => {
    if (favorited) {
      remove(stopId);
      show(t('favorites.toastRemoved', { stopName }), {
        action: { label: t('favorites.toastUndo'), onClick: () => add(stopId) },
      });
      return;
    }
    if (isFull) {
      show(t('favorites.toastFull'));
      return;
    }
    add(stopId);
    show(t('favorites.toastAdded', { stopName }), {
      action: { label: t('favorites.toastUndo'), onClick: () => remove(stopId) },
    });
  };

  const label = favorited
    ? t('favorites.ariaRemove', { stopName })
    : t('favorites.ariaAdd', { stopName });

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
