import { Pencil } from 'lucide-react';
import type { Slot } from '../../../lib/persistence';
import { sound } from '../../../audio/soundManager';

interface SelectedCharacterBarProps {
  slot: Slot;
  onEdit: () => void;
  onEnter: () => void;
}

/** Bottom-left launcher of the select screen: who is picked, an edit button and the big enter-lobby button. */
export function SelectedCharacterBar({ slot, onEdit, onEnter }: SelectedCharacterBarProps) {
  const { name, gender } = slot.state;
  return (
    <section aria-label="Nhân vật đang chọn" className="pointer-events-auto w-[300px] max-w-[calc(100vw-2.5rem)]">
      <div className="flex items-center gap-3 rounded-t-md border border-b-0 border-white/15 bg-[#0d1826]/90 px-3 py-2 backdrop-blur-sm">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border-2 border-[#ffd34d] bg-linear-to-br from-[#ffd34d] to-[#c98a00] text-lg font-black text-[#1a1306]">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-extrabold uppercase italic text-white">{name}</span>
          <span className="text-[11px] text-white/60">{gender === 'female' ? 'Nữ' : 'Nam'}</span>
        </span>
        <button
          type="button"
          onClick={() => { sound.playClick(); onEdit(); }}
          className="flex items-center gap-1.5 rounded-sm border border-white/25 px-2.5 py-1.5 text-[11px] font-semibold uppercase text-white/85 transition hover:border-[#ffd34d]/70 hover:text-white"
        >
          <Pencil size={13} /> Chỉnh sửa
        </button>
      </div>
      <button
        type="button"
        aria-label={`Vào sảnh với ${name}`}
        onClick={() => { sound.playTriumph(); onEnter(); }}
        className="block h-16 w-full rounded-b-md bg-linear-to-b from-[#ffe066] to-[#f2b705] text-[28px] font-black uppercase tracking-wider text-[#1a1306] shadow-[0_8px_24px_rgba(242,183,5,0.35)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white"
      >
        Vào sảnh
      </button>
    </section>
  );
}
