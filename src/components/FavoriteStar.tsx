import { useGameStore, FavoriteCategory } from '../store';

export interface FavoriteStarProps {
  category: FavoriteCategory;
  /** Bundled record id: the favorites key. */
  id: string;
  /** Display name: used only for the aria-label. */
  name: string;
}

/**
 * Yellow star toggle that adds or removes an item from the persisted favorites list.
 * Shows an outline when not favorited and a filled star when favorited.
 */
export default function FavoriteStar({ category, id, name }: FavoriteStarProps) {
  const isFavorite = useGameStore((state) => state.favorites[category].includes(id));
  const toggleFavorite = useGameStore((state) => state.toggleFavorite);

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(category, id)}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, flexShrink: 0 }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z"
          fill={isFavorite ? '#fdd835' : 'none'}
          stroke="#fdd835"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
