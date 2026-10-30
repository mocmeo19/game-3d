import { Plus } from 'lucide-react';
import { sound } from '../../../audio/soundManager';

interface EmptySlotCardProps {
  onCreate: () => void;
}

/** A free save slot in the roster; pressing it starts a new character. */
export function EmptySlotCard({ onCreate }: EmptySlotCardProps) {
  return (
    <button
      type="button"
      onClick={() => { sound.playClick(); onCreate(); }}
      className="group flex h-[86px] w-full items-center gap-3 rounded-md border border-dashed border-white/25 bg-black/20 px-3 text-left transition hover:border-[#ffd34d]/70 hover:bg-[#ffd34d]/5 focus-visible:outline-2 focus-visible:outline-[#ffd34d]"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white/70 transition group-hover:border-[#ffd34d] group-hover:text-[#ffd34d]">
        <Plus size={20} />
      </span>
      <span className="flex flex-col">
        <span className="text-[13px] font-bold uppercase italic tracking-wide text-white/85">Tạo nhân vật</span>
        <span className="text-[10px] text-white/45">Ô trống</span>
      </span>
    </button>
  );
}
