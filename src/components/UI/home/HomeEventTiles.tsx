import { CalendarDays, ChevronRight, Gem, Gift, Percent } from 'lucide-react';
import { TOP_UP_EVENT_ID, type GameEvent } from './homeEvents';
import { FeaturedEventBanner } from './FeaturedEventBanner';
import { sound } from '../../../audio/soundManager';

interface HomeEventTilesProps {
  events: readonly GameEvent[];
  now: Date;
  seenIds: readonly string[];
  unreadCount: number;
  onOpenEvents: (eventId: string | null) => void;
  onOpenTopUp: () => void;
}

const TILE_CLASS = 'group relative flex h-[68px] flex-col items-center justify-center gap-1 overflow-hidden rounded-sm border border-white/35 shadow-lg transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-amber-300';

export function HomeEventTiles({ events, now, seenIds, unreadCount, onOpenEvents, onOpenTopUp }: HomeEventTilesProps) {
  const hasOffer = events.some((event) => event.id === TOP_UP_EVENT_ID);
  const click = (action: () => void) => () => { sound.playClick(); action(); };

  return (
    <aside aria-label="Khám phá sự kiện" className="pointer-events-auto flex w-[196px] flex-col gap-2.5 sm:w-[224px]">
      <FeaturedEventBanner events={events} now={now} seenIds={seenIds} onOpen={onOpenEvents} />
      <div className={`grid gap-2.5 ${hasOffer ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button type="button" onClick={click(onOpenTopUp)} className={`${TILE_CLASS} bg-[radial-gradient(ellipse_at_top,#fff_0%,#c5e4f0_65%,#7da5b7_100%)] text-[#153f55]`} aria-label="Nạp Kim cương" aria-haspopup="dialog">
          <span aria-hidden className="absolute -right-2 -top-3 rotate-12 text-white/40"><Gem size={80} strokeWidth={1} /></span>
          <Gem aria-hidden size={28} strokeWidth={1.8} className="relative text-sky-600 drop-shadow-[0_2px_3px_#fff] transition-transform group-hover:-translate-y-0.5" />
          <span className="relative text-[10px] font-black uppercase tracking-wider">Nạp KC</span>
        </button>
        {hasOffer && (
          <button type="button" onClick={click(() => onOpenEvents(TOP_UP_EVENT_ID))} className={`${TILE_CLASS} bg-[radial-gradient(ellipse_at_top,#ffeeb0_0%,#e9be45_65%,#a7761c_100%)] text-[#553712]`} aria-label="Ưu đãi nạp Kim cương" aria-haspopup="dialog">
            <span className="absolute left-0 top-0 bg-[#d83b30] px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white">BONUS</span>
            <Gift aria-hidden size={62} className="absolute -right-3 -top-1 -rotate-12 text-white/20" />
            <Percent aria-hidden size={27} strokeWidth={2.5} className="relative transition-transform group-hover:-translate-y-0.5" />
            <span className="relative text-[10px] font-black uppercase tracking-wider">Ưu đãi</span>
          </button>
        )}
      </div>
      <button type="button" onClick={click(() => onOpenEvents(null))} aria-haspopup="dialog" aria-label={`Sự kiện, ${unreadCount} chưa xem`} className="group flex min-h-11 items-center gap-2.5 rounded-sm border border-white/35 bg-linear-to-r from-[#f4f1e9] to-[#cac8bf] px-3 text-[#22282c] shadow-lg hover:brightness-110 focus-visible:outline-2 focus-visible:outline-amber-300">
        <CalendarDays aria-hidden size={20} className="text-[#bd3a2d]" />
        <span className="flex-1 text-left text-[14px] font-black uppercase italic tracking-wide">Sự kiện</span>
        {unreadCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#df4438] px-1 text-[10px] font-bold text-white">{unreadCount}</span>}
        <ChevronRight size={14} aria-hidden className="text-black/40 transition-transform group-hover:translate-x-0.5" />
      </button>
    </aside>
  );
}
