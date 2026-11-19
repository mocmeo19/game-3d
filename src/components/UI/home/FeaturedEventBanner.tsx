import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { timeLeftLabel, type GameEvent } from './homeEvents';
import { useEventCarousel } from './useEventCarousel';
import { sound } from '../../../audio/soundManager';

interface FeaturedEventBannerProps {
  events: readonly GameEvent[];
  now: Date;
  seenIds: readonly string[];
  onOpen: (eventId: string) => void;
}

export function FeaturedEventBanner({ events, now, seenIds, onOpen }: FeaturedEventBannerProps) {
  const carousel = useEventCarousel(events.length);
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const featured = events[carousel.index];
  if (!featured) return null;

  const select = (index: number) => {
    sound.playClick();
    carousel.select((index + events.length) % events.length);
  };

  return (
    <section
      aria-label="Sự kiện nổi bật"
      aria-roledescription="băng chuyền"
      onMouseEnter={() => carousel.setIsHovered(true)}
      onMouseLeave={() => carousel.setIsHovered(false)}
      onFocusCapture={() => carousel.setIsFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) carousel.setIsFocused(false); }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        select(carousel.index + (event.key === 'ArrowRight' ? 1 : -1));
      }}
      className="overflow-hidden rounded-sm border border-white/35 bg-[#141c23] shadow-[0_8px_28px_#0008]"
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Sự kiện ${featured.title}, ${timeLeftLabel(featured, now)}`}
        onClick={() => {
          if (!didSwipe.current) { sound.playClick(); onOpen(featured.id); }
          didSwipe.current = false;
        }}
        onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; didSwipe.current = false; }}
        onTouchEnd={(event) => {
          const distance = event.changedTouches[0].clientX - (touchStartX.current ?? event.changedTouches[0].clientX);
          didSwipe.current = Math.abs(distance) > 40;
          if (didSwipe.current) select(carousel.index + (distance < 0 ? 1 : -1));
          touchStartX.current = null;
        }}
        onTouchCancel={() => { touchStartX.current = null; didSwipe.current = false; }}
        className="group relative block w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-300"
      >
        <div className="relative h-[116px] overflow-hidden sm:h-[132px]">
          <img src={featured.image} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105" />
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/15 to-black/25" />
          <div className="absolute inset-x-2.5 top-2 flex items-start justify-between gap-1">
            <span className="rounded-xs border border-white/20 bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">{timeLeftLabel(featured, now)}</span>
            {!seenIds.includes(featured.id) && <span className="bg-[#ec493e] px-1.5 py-0.5 text-[8px] font-black text-white">MỚI</span>}
          </div>
          <div className="absolute inset-x-3 bottom-3">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.2em] text-amber-200">{featured.tagline}</p>
            <p className="max-w-[175px] text-[19px] leading-[1.05] font-black italic tracking-tight text-white drop-shadow-lg">{featured.headline}</p>
          </div>
        </div>
        <div className="flex min-h-8 items-center gap-2 bg-linear-to-r from-[#f5f1e6] to-[#cbc9c2] px-2.5 py-1.5 text-[#20252b]">
          <span className="flex-1 truncate text-[12px] font-black italic">{featured.title}</span>
          <ChevronRight size={16} strokeWidth={3} className="text-[#bf3e2b]" aria-hidden />
        </div>
      </button>
      {events.length > 1 && (
        <div className="flex h-7 items-center justify-between bg-[#111922] px-1 text-white/65">
          <button type="button" aria-label="Sự kiện trước" onClick={() => select(carousel.index - 1)} className="grid h-7 w-7 place-items-center hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"><ChevronLeft size={13} /></button>
          <div className="flex items-center gap-0.5">
            {events.map((event, index) => (
              <button key={event.id} type="button" aria-label={`Xem banner ${event.title}`} aria-current={index === carousel.index ? 'true' : undefined} onClick={() => select(index)} className="grid h-7 min-w-6 place-items-center focus-visible:outline-2 focus-visible:outline-amber-300">
                <span className={`h-1 rounded-full transition-all ${index === carousel.index ? 'w-4 bg-amber-300' : 'w-1 bg-white/35'}`} />
              </button>
            ))}
          </div>
          <button type="button" aria-label="Sự kiện tiếp theo" onClick={() => select(carousel.index + 1)} className="grid h-7 w-7 place-items-center hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"><ChevronRight size={13} /></button>
          <button type="button" aria-label={carousel.isPaused ? 'Tiếp tục chuyển banner' : 'Tạm dừng chuyển banner'} onClick={carousel.togglePaused} className="grid h-7 w-7 place-items-center border-l border-white/10 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300">
            {carousel.isPaused ? <Play size={11} /> : <Pause size={11} />}
          </button>
        </div>
      )}
    </section>
  );
}
