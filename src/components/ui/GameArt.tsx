import { cn } from '@/lib/utils';
import { badgeArtUrl, gloveArtUrl } from '@/lib/gameArt';

interface GameArtProps {
  id: string;
  /** Not unlocked yet, so it shows dimmed, with the color still readable as something to chase */
  locked?: boolean;
  className?: string;
}

// The art is decorative: the name always sits next to it, so screen readers skip the image
const artClasses = (locked: boolean | undefined, className: string | undefined) =>
  cn('object-cover', locked && 'saturate-50 opacity-70', className);

export function GloveArt({ id, locked, className }: GameArtProps) {
  return <img src={gloveArtUrl(id)} alt="" loading="lazy" decoding="async" className={artClasses(locked, className)} />;
}

export function BadgeArt({ id, locked, className }: GameArtProps) {
  return <img src={badgeArtUrl(id)} alt="" loading="lazy" decoding="async" className={artClasses(locked, className)} />;
}
