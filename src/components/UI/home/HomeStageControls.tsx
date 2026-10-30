import { RotateCw } from 'lucide-react';
import { AudioControls } from '../AudioControls';

interface HomeStageControlsProps {
  turntableOn: boolean;
  onToggleTurntable: () => void;
}

/** Icon-only stage toggles sitting just above the bottom menu. */
export function HomeStageControls({ turntableOn, onToggleTurntable }: HomeStageControlsProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={turntableOn}
        aria-label="Xoay nhân vật"
        title="Xoay nhân vật"
        onClick={onToggleTurntable}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition ${turntableOn ? 'text-[#ffd34d]' : 'text-white/85 hover:text-white'}`}
      >
        <RotateCw size={20} className={turntableOn ? 'motion-safe:animate-spin [animation-duration:3s]' : ''} />
      </button>
      <AudioControls placement="above-right" isBare />
    </div>
  );
}
