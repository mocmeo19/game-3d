import type { Slot } from '../../../lib/persistence';
import { sound } from '../../../audio/soundManager';

interface CharacterSlotCardProps {
  slot: Slot;
  isSelected: boolean;
  onPick: () => void;
  onEnter: () => void;
}

const savedAtLabel = (savedAt: number): string =>
  new Date(savedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** One saved character in the roster: click picks it, double-click (or Enter on the picked card) enters the lobby. */
export function CharacterSlotCard({ slot, isSelected, onPick, onEnter }: CharacterSlotCardProps) {
  const genderLabel = slot.state.gender === 'female' ? 'Nữ' : 'Nam';
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => { sound.playClick(); onPick(); }}
      onDoubleClick={onEnter}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || !isSelected) return;
        event.preventDefault();
        onEnter();
      }}
      className={`group relative flex w-full items-stretch gap-3 overflow-hidden rounded-md border p-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-[#ffd34d] ${isSelected ? 'border-[#ffd34d] bg-linear-to-r from-[#ffd34d]/20 to-transparent' : 'border-white/15 bg-black/35 hover:border-white/40'}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${isSelected ? 'bg-[#ffd34d]' : 'bg-transparent'}`} />
      <span className="h-[72px] w-[60px] shrink-0 overflow-hidden rounded-sm border border-white/10 bg-linear-to-b from-[#3b3f4a] to-[#15171c]">
        {slot.thumb && <img src={slot.thumb} alt="" draggable={false} className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className={`truncate text-[15px] font-extrabold uppercase italic tracking-wide ${isSelected ? 'text-[#ffd34d]' : 'text-white'}`}>{slot.state.name}</span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-sm bg-white/15 px-1.5 text-[10px] font-semibold text-white/85">{genderLabel}</span>
          {isSelected && <span className="rounded-sm bg-[#ffd34d] px-1.5 text-[10px] font-bold uppercase text-[#1a1306]">Đang chọn</span>}
        </span>
        <span className="text-[10px] text-white/45">Lưu {savedAtLabel(slot.savedAt)}</span>
      </span>
    </button>
  );
}
