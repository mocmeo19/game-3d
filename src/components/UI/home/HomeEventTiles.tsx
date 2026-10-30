import { useState } from 'react';
import { CalendarDays, ChevronRight, Gem, Percent } from 'lucide-react';
import { activeGameEvents, timeLeftLabel, TOP_UP_EVENT_ID } from './homeEvents';
import { useRotatingIndex } from '../../../loading/useRotatingIndex';
import { sound } from '../../../audio/soundManager';

interface HomeEventTilesProps {
  /** `null` opens the event list without highlighting one. */
  onOpenEvents: (eventId: string | null) => void;
  onOpenTopUp: () => void;
}

const BANNER_ROTATE_MS = 5000;
const tileClassName = 'relative grid h-[58px] place-items-center rounded-md border border-white/25 shadow-[0_6px_18px_rgba(0,0,0,0.4)] transition hover:border-[#ffd34d]/70 focus-visible:outline-2 focus-visible:outline-[#ffd34d]';

/** Event column on the right edge of the lobby: rotating featured banner, quick deals and the event list button. */
export function HomeEventTiles({ onOpenEvents, onOpenTopUp }: HomeEventTilesProps) {
  const [now] = useState(() => new Date());
  const events = activeGameEvents(now);
  const featuredIndex = useRotatingIndex(events.length, BANNER_ROTATE_MS);
  const featured = events[featuredIndex];
  const hasTopUpEvent = events.some((event) => event.id === TOP_UP_EVENT_ID);
  const click = (action: () => void) => () => { sound.playClick(); action(); };

  return (
    <div className="pointer-events-auto flex w-[170px] flex-col gap-2">
      {featured && (
        <button
          type="button"
          onClick={click(() => onOpenEvents(featured.id))}
          aria-label={`Sự kiện ${featured.title}, ${timeLeftLabel(featured, now)}`}
          className="group relative h-[104px] overflow-hidden rounded-md border border-white/25 text-left shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition hover:border-[#ffd34d]/70 focus-visible:outline-2 focus-visible:outline-[#ffd34d]"
          style={{ background: `linear-gradient(135deg, ${featured.gradientFrom}, ${featured.gradientTo} 80%)` }}
        >
          <featured.Icon aria-hidden size={64} strokeWidth={1.4} className="absolute -right-2 -top-1 text-white/25 transition-transform group-hover:scale-110" />
          <span className="absolute left-2 top-2 rounded-sm bg-black/45 px-1.5 text-[9px] font-semibold text-white/85">{timeLeftLabel(featured, now)}</span>
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-linear-to-r from-[#f2f2f2] to-[#c9c9c9] px-2 py-1">
            <span className="flex-1 truncate text-[12px] font-extrabold italic text-[#1a1a1a]">{featured.title}</span>
            <ChevronRight aria-hidden size={14} className="text-[#e8463a]" strokeWidth={3} />
          </span>
          <span aria-hidden className="absolute bottom-8 left-2 flex gap-1">
            {events.map((event, index) => (
              <span key={event.id} className={`h-1 rounded-full transition-all ${index === featuredIndex ? 'w-3 bg-white' : 'w-1 bg-white/45'}`} />
            ))}
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={click(onOpenTopUp)} className={`${tileClassName} bg-linear-to-br from-[#f7f7f7] to-[#d4d4d4]`} aria-label="Nạp Kim cương">
          <span className="absolute -left-1 -top-1.5 rounded-sm bg-[#e8463a] px-1 text-[8px] font-bold text-white">NEW</span>
          <Gem aria-hidden size={24} className="text-[#1a8fc4]" />
          <span className="absolute bottom-0.5 text-[9px] font-bold uppercase text-[#0b3346]">Nạp KC</span>
        </button>
        {hasTopUpEvent && (
          <button type="button" onClick={click(() => onOpenEvents(TOP_UP_EVENT_ID))} className={`${tileClassName} bg-linear-to-br from-[#ffe08a] to-[#e0a800]`} aria-label="Ưu đãi nạp Kim cương">
            <span className="absolute -left-1 -top-1.5 rounded-sm bg-[#e8463a] px-1 text-[8px] font-bold text-white">SALE</span>
            <Percent aria-hidden size={22} className="text-[#7a1d12]" strokeWidth={3} />
            <span className="absolute bottom-0.5 text-[9px] font-bold uppercase text-[#3a1a00]">Ưu đãi</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={click(() => onOpenEvents(null))}
        aria-controls="home-tab-panel"
        className="flex h-9 items-center gap-2 rounded-md border border-white/25 bg-linear-to-r from-[#f2f2f2] to-[#c9c9c9] px-2.5 text-[13px] font-extrabold uppercase italic text-[#1a1a1a] shadow-[0_6px_18px_rgba(0,0,0,0.4)] transition hover:border-[#ffd34d] focus-visible:outline-2 focus-visible:outline-[#ffd34d]"
      >
        <CalendarDays aria-hidden size={16} className="text-[#e8463a]" />
        <span className="flex-1 text-left">Sự kiện</span>
        <span className="rounded-full bg-[#e8463a] px-1.5 text-[10px] not-italic text-white">{events.length}</span>
      </button>
    </div>
  );
}
