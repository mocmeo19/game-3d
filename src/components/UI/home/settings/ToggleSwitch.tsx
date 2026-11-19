import { sound } from '../../../../audio/soundManager';

interface ToggleSwitchProps {
  label: string;
  isOn: boolean;
  onChange: (isOn: boolean) => void;
}

export function ToggleSwitch({ label, isOn, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      onClick={() => { sound.playClick(); onChange(!isOn); }}
      className="group flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd34d]"
    >
      <span className={`w-8 text-right text-[12px] font-bold uppercase ${isOn ? 'text-[#ffd34d]' : 'text-white/45'}`}>{isOn ? 'Bật' : 'Tắt'}</span>
      <span aria-hidden className={`relative block h-6 w-11 shrink-0 rounded-full transition-colors ${isOn ? 'bg-[#ffd34d]' : 'bg-white/15 group-hover:bg-white/22'}`}>
        <span className={`absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}
