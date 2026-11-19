import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { EVENT_CATEGORIES, timeLeftLabel, type EventCategory, type GameEvent, type GameEventAction } from './homeEvents';
import { EventCard } from './EventCard';
import { sound } from '../../../audio/soundManager';

interface EventsTabProps {
  events: readonly GameEvent[];
  now: Date;
  seenIds: readonly string[];
  highlightedEventId: string | null;
  onSeen: (eventId: string) => void;
  onEventAction: (action: GameEventAction) => void;
}

export function EventsTab({ events, now, seenIds, highlightedEventId, onSeen, onEventAction }: EventsTabProps) {
  const [category, setCategory] = useState<EventCategory>('all');
  const [selectedId, setSelectedId] = useState(highlightedEventId ?? events[0]?.id);
  const detailRef = useRef<HTMLDivElement>(null);
  const filtered = events.filter((event) => category === 'all' || event.category === category);
  const selected = filtered.find((event) => event.id === selectedId) ?? filtered[0];

  useEffect(() => {
    if (selected) onSeen(selected.id);
    if (detailRef.current) detailRef.current.scrollTop = 0;
  }, [selected?.id, onSeen]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label="Phân loại sự kiện" className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-[#101a24] px-3 sm:px-6">
        {EVENT_CATEGORIES.map((item) => (
          <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => { sound.playClick(); setCategory(item.id); }} className={`min-h-12 shrink-0 border-b-2 px-3 text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-amber-300 sm:px-5 ${category === item.id ? 'border-amber-300 bg-amber-200/5 text-amber-200' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {item.label}<span className="ml-2 text-[10px] opacity-55">{events.filter((event) => item.id === 'all' || event.category === item.id).length}</span>
          </button>
        ))}
      </nav>
      {selected ? (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[215px_minmax(0,1fr)] sm:grid-rows-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Danh sách sự kiện" className="flex gap-2 overflow-x-auto border-b border-white/10 bg-[#0b141d] p-3 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
            {filtered.map((event) => {
              const isSelected = selected.id === event.id;
              return (
                <button key={event.id} type="button" aria-current={isSelected ? 'true' : undefined} onClick={() => { sound.playClick(); setSelectedId(event.id); }} className={`relative flex min-w-[170px] shrink-0 items-center gap-3 overflow-hidden border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 sm:min-w-0 ${isSelected ? 'border-amber-300/60 bg-linear-to-r from-amber-300/15 to-transparent text-amber-100' : 'border-white/8 bg-white/3 text-slate-300 hover:bg-white/7'}`}>
                  {isSelected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-amber-300" />}
                  <event.Icon size={23} strokeWidth={1.5} aria-hidden className={`shrink-0 ${isSelected ? 'text-amber-300' : 'text-slate-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold">{event.title}</span>
                    <span className="mt-1.5 block text-[10px] text-slate-400">{timeLeftLabel(event, now)}</span>
                  </span>
                  {!seenIds.includes(event.id) ? <span aria-label="Chưa xem" className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_7px_#f8717180]" /> : <ChevronRight size={12} aria-hidden className="shrink-0 opacity-35" />}
                </button>
              );
            })}
          </nav>
          <div ref={detailRef} className="min-h-0 overflow-y-auto overscroll-contain">
            <EventCard event={selected} now={now} onAction={() => { sound.playClick(); onEventAction(selected.action); }} />
          </div>
        </div>
      ) : (
        <div role="status" className="grid flex-1 place-content-center gap-3 p-8 text-center text-slate-400">
          <CalendarDays size={36} strokeWidth={1} className="mx-auto text-slate-600" aria-hidden />
          <p className="text-sm">Chưa có sự kiện đang diễn ra trong mục này.</p>
          <p className="text-xs text-slate-500">Hãy quay lại sau để khám phá hoạt động mới.</p>
        </div>
      )}
    </div>
  );
}
