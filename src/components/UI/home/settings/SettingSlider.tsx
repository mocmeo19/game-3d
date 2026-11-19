import { Minus, Plus } from 'lucide-react';

interface SettingSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
  onChange: (value: number) => void;
}

/** Floating-point steps (0.05) drift; values are snapped back onto the step grid. */
const snapToStep = (value: number, min: number, step: number) => Number((Math.round((value - min) / step) * step + min).toFixed(4));

/** A slider with step buttons on both sides and the current value boxed on the right. */
export function SettingSlider({ label, value, min, max, step, formatValue, onChange }: SettingSliderProps) {
  const change = (next: number) => {
    const clamped = Math.max(min, Math.min(max, snapToStep(next, min, step)));
    if (clamped !== value) onChange(clamped);
  };
  const stepButtonClassName = 'grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-white/8 text-white/75 hover:bg-white/14 hover:text-white disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[#ffd34d]';
  return (
    <div className="flex w-full items-center gap-2 sm:w-[340px]">
      <button type="button" aria-label={`Giảm ${label.toLowerCase()}`} disabled={value <= min} onClick={() => change(value - step)} className={stepButtonClassName}>
        <Minus size={14} />
      </button>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={formatValue(value)}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => change(Number(event.target.value))}
        className="h-8 min-w-0 flex-1 cursor-pointer accent-[#ffd34d]"
      />
      <button type="button" aria-label={`Tăng ${label.toLowerCase()}`} disabled={value >= max} onClick={() => change(value + step)} className={stepButtonClassName}>
        <Plus size={14} />
      </button>
      <output className="w-14 shrink-0 rounded-sm bg-black/40 py-1 text-center text-[13px] font-bold tabular-nums text-[#ffe9a6]">{formatValue(value)}</output>
    </div>
  );
}
