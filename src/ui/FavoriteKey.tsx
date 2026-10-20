import { Button } from './common';
import { Icon } from './icons';

/** Star a satellite. A latching key: pressed means it's a favorite. */
export function FavoriteKey({ name, on, onToggle }: { name: string; on: boolean; onToggle: () => void }) {
  return (
    <Button expand="inline" size="small" className="key-icon fav-key" aria-pressed={on} aria-label={`Favorite ${name}`} onClick={onToggle}>
      <Icon name="star" size={18} filled={on} />
    </Button>
  );
}
