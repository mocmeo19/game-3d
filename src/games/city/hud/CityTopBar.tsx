import type { CityView } from '../citySnapshot';
import { WantedStars } from './WantedStars';

interface CityTopBarProps {
  view: CityView;
}

/** Top right: who is played, their money and the wanted stars. */
export function CityTopBar({ view }: CityTopBarProps) {
  return (
    <div className="pointer-events-none absolute right-4 top-14 flex flex-col items-end gap-1 text-right [text-shadow:0_2px_4px_rgba(0,0,0,0.9)]">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">{view.hero.name}</span>
      <span className="text-2xl font-black tabular-nums text-[#7bd88f]">${view.money.toLocaleString('vi-VN')}</span>
      <WantedStars stars={view.wanted.stars} isSearching={view.wanted.isSearching} />
      <span className="text-[11px] text-white/60">
        Cốt truyện {view.story.passed}/{view.story.total}
      </span>
    </div>
  );
}
