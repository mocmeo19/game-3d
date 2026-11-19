import { useEffect, useRef } from 'react';
import { CalendarDays, X } from 'lucide-react';
import type { GameEvent, GameEventAction } from './homeEvents';
import { EventsTab } from './EventsTab';

interface EventCenterDialogProps {
  events: readonly GameEvent[];
  now: Date;
  seenIds: readonly string[];
  highlightedEventId: string | null;
  onSeen: (eventId: string) => void;
  onEventAction: (action: GameEventAction) => void;
  onClose: () => void;
}

export function EventCenterDialog({ onClose, ...props }: EventCenterDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="event-center-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
      className="pointer-events-auto fixed inset-0 m-auto h-[min(720px,92dvh)] max-h-none w-[min(1080px,96vw)] max-w-none overflow-hidden rounded-sm border border-slate-500/40 bg-[#0b141d] p-0 text-white shadow-2xl backdrop:bg-[#03080e]/80 backdrop:backdrop-blur-sm open:flex open:flex-col"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-linear-to-r from-[#253442] to-[#111b25] px-4 py-4 sm:px-6">
        <span className="grid h-10 w-10 place-items-center border border-amber-300/35 bg-amber-200/5 text-amber-300"><CalendarDays size={22} strokeWidth={1.5} aria-hidden /></span>
        <div className="flex-1">
          <p className="mb-0.5 text-[9px] font-semibold tracking-[0.3em] text-slate-400">KHÁM PHÁ & THAM GIA</p>
          <h2 id="event-center-title" className="text-xl font-black uppercase italic tracking-wide sm:text-2xl">Trung tâm sự kiện</h2>
        </div>
        <span className="hidden border-r border-white/15 pr-5 text-[11px] text-slate-400 sm:block"><strong className="mr-1.5 text-amber-200">{props.events.length}</strong>đang diễn ra</span>
        <button autoFocus type="button" aria-label="Đóng sự kiện" onClick={onClose} className="grid h-10 w-10 place-items-center text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"><X size={24} strokeWidth={1.5} /></button>
      </header>
      <EventsTab {...props} />
    </dialog>
  );
}
