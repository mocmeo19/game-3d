import { useId } from 'react';

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** How the value reads next to the slider (e.g. "45%", "12°"). */
  format: (value: number) => string;
  onChange: (value: number) => void;
}

export function RangeField({ label, value, min, max, step, format, onChange }: RangeFieldProps) {
  const id = useId();
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)_56px] items-center gap-2 text-xs">
      <label htmlFor={id} className="text-slate-400">{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-sky-300" />
      <span className="text-right font-mono text-slate-300">{format(value)}</span>
    </div>
  );
}
