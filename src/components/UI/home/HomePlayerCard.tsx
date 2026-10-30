import { ChevronLeft } from 'lucide-react';
import type { CharacterState } from '../../../types/character';
import { WEAPON_KINDS } from '../../../constants/weaponKinds';
import { sound } from '../../../audio/soundManager';

interface HomePlayerCardProps {
  characterState: CharacterState;
  onChooseCharacter: () => void;
}

/** Top-left identity block: back to the character list, a portrait badge, the name and a short summary. */
export function HomePlayerCard({ characterState, onChooseCharacter }: HomePlayerCardProps) {
  const weapon = WEAPON_KINDS[characterState.weapon];
  const initial = (characterState.name || '?').charAt(0).toUpperCase();
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <button
        type="button"
        onClick={() => { sound.playClick(); onChooseCharacter(); }}
        aria-label="Chọn nhân vật"
        title="Chọn nhân vật"
        className="grid h-10 w-8 place-items-center rounded-md bg-black/35 text-white/85 hover:bg-black/55 hover:text-white"
      >
        <ChevronLeft size={22} />
      </button>
      <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-linear-to-r from-black/60 via-black/40 to-transparent py-1.5 pl-1.5 pr-6">
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-md border-2 border-[#ffd34d] bg-linear-to-br from-[#ffcf3f] to-[#e88a12] text-[22px] font-black text-[#3a2400] shadow-[0_0_12px_rgba(255,200,60,0.45)]"
        >
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="max-w-[220px] truncate text-[17px] font-bold leading-tight text-white text-shadow">{characterState.name || 'Chưa đặt tên'}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/75">
            <span className="rounded-sm bg-white/15 px-1.5 py-px font-semibold text-white/90">{characterState.gender === 'female' ? 'Nữ' : 'Nam'}</span>
            <span aria-hidden>{weapon.badge}</span>
            <span className="truncate">{weapon.name}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
