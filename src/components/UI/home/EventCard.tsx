import { timeLeftLabel, type GameEvent } from './homeEvents';

interface EventCardProps {
  event: GameEvent;
  now: Date;
  isHighlighted: boolean;
  onAction: () => void;
}

export function EventCard({ event, now, isHighlighted, onAction }: EventCardProps) {
  return (
    <article
      id={`event-${event.id}`}
      aria-label={event.title}
      className={`overflow-hidden rounded-md border ${isHighlighted ? 'border-[#ffd34d]' : 'border-white/15'} bg-black/30`}
    >
      <div className="relative h-20 px-3 py-2" style={{ background: `linear-gradient(135deg, ${event.gradientFrom}, ${event.gradientTo} 85%)` }}>
        <event.Icon aria-hidden size={72} strokeWidth={1.3} className="absolute -top-1 right-1 text-white/25" />
        <span className="rounded-sm bg-black/45 px-1.5 text-[10px] text-white/85">{timeLeftLabel(event, now)}</span>
        <h3 className="mt-2 text-[16px] font-extrabold italic text-white text-shadow">{event.title}</h3>
        <p className="text-[11px] text-white/80">{event.tagline}</p>
      </div>
      <div className="flex items-end gap-3 px-3 py-2.5">
        <p className="flex-1 text-[11px] leading-relaxed text-white/70">{event.description}</p>
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-sm bg-[#ffd34d] px-3 py-1.5 text-[11px] font-bold uppercase text-[#1a1306] hover:bg-[#ffdc6b]"
        >
          {event.actionLabel}
        </button>
      </div>
    </article>
  );
}
