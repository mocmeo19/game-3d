import { Settings } from 'lucide-react';
import { sound } from '../../../audio/soundManager';

interface HomeSettingsButtonProps {
  onOpenSettings: () => void;
}

/** Gear next to the balances that opens the game settings. */
export function HomeSettingsButton({ onOpenSettings }: HomeSettingsButtonProps) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label="Cài đặt game"
      title="Cài đặt game"
      onClick={() => { sound.playClick(); onOpenSettings(); }}
      className="group grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/25 bg-black/55 text-white/85 hover:border-[#ffd34d]/60 hover:text-[#ffd34d] focus-visible:outline-2 focus-visible:outline-white"
    >
      <Settings size={18} className="transition-transform duration-300 group-hover:rotate-90" />
    </button>
  );
}
