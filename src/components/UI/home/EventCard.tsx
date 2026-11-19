import { ArrowUpRight, CalendarDays, Clock3, Info } from 'lucide-react';
import { timeLeftLabel, type GameEvent } from './homeEvents';

interface EventCardProps {
  event: GameEvent;
  now: Date;
  onAction: () => void;
}

export function EventCard({ event, now, onAction }: EventCardProps) {
  const endDate = new Date(`${event.endsOn}T23:59:59`).toLocaleDateString('vi-VN');
  return (
    <article aria-label={event.title} className="flex min-h-full flex-col bg-[#111c26]">
      <div className="relative min-h-[225px] overflow-hidden sm:min-h-[280px]">
        <img src={event.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-r from-[#080e15]/85 via-[#080e15]/35 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-t from-[#111c26] via-transparent to-black/15" />
        <div className="relative flex min-h-[225px] flex-col justify-end p-5 sm:min-h-[280px] sm:p-7">
          <span className="mb-auto flex w-fit items-center gap-1.5 border border-amber-200/30 bg-black/40 px-2 py-1 text-[10px] font-semibold text-amber-100"><Clock3 size={12} aria-hidden />{timeLeftLabel(event, now)}</span>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300">{event.tagline}</p>
          <h3 className="mt-2 max-w-md text-3xl leading-none font-black italic tracking-tight text-white sm:text-5xl">{event.headline}</h3>
          <p className="mt-3 text-sm font-semibold text-white/80">{event.title}</p>
        </div>
      </div>
      <div className="flex-1 space-y-5 px-5 pb-6 sm:px-7">
        <p className="max-w-xl text-sm leading-relaxed text-slate-300">{event.description}</p>
        <div className="flex items-center gap-2 border-y border-white/10 py-3 text-xs text-slate-400">
          <CalendarDays size={15} aria-hidden className="text-amber-300/80" />
          <span>Đến <time dateTime={event.endsOn} className="font-semibold text-slate-200">23:59 · {endDate}</time></span>
        </div>
        <section aria-label="Hướng dẫn tham gia">
          <h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white"><Info size={14} className="text-amber-300" aria-hidden />Cách tham gia</h4>
          <ol className="space-y-2.5">
            {event.instructions.map((instruction, index) => (
              <li key={instruction} className="flex gap-3 text-xs leading-relaxed text-slate-300">
                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center border border-white/15 bg-white/5 text-[10px] font-bold text-amber-200">{index + 1}</span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#101b25]/95 px-5 py-4 backdrop-blur-sm sm:px-7">
        <span className="text-[10px] uppercase tracking-widest text-slate-400">{event.action.kind === 'top-up' ? 'Gói nạp & quà tặng kèm' : 'Sẵn sàng tham gia'}</span>
        <button type="button" onClick={onAction} className="flex min-h-11 items-center justify-center gap-4 bg-linear-to-b from-[#ffe38b] to-[#e6b440] px-5 text-xs font-black uppercase tracking-wide text-[#282210] shadow-[0_3px_0_#9b7424] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
          {event.actionLabel}<ArrowUpRight size={17} aria-hidden />
        </button>
      </footer>
    </article>
  );
}
