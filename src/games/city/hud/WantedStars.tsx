import { Star } from 'lucide-react';
import { MAX_STARS } from '../police/wanted';

interface WantedStarsProps {
  stars: number;
  /** The police lost sight of the player: the stars blink while they search. */
  isSearching: boolean;
}

/** The wanted level as five stars. */
export function WantedStars({ stars, isSearching }: WantedStarsProps) {
  return (
    <div className={`flex gap-0.5 ${isSearching ? 'animate-pulse' : ''}`} role="img" aria-label={stars ? `Bị truy nã ${stars} sao` : 'Không bị truy nã'}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Star key={i} size={20} aria-hidden strokeWidth={2.2} className={i < stars ? 'fill-[#f5f0e6] text-[#f5f0e6] drop-shadow-[0_0_3px_rgba(0,0,0,0.9)]' : 'text-white/25'} />
      ))}
    </div>
  );
}
