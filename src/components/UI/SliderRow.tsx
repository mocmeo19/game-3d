import type { SliderDef } from '../../constants/sliders';
import { fromStep, round2, sliderSpan, toStep } from './sliderValues';

export function SliderRow({ def: slider, value, onChange }: {
  def: SliderDef; value: number; onChange: (value: number) => void;
}) {
  const span = sliderSpan(slider);
  const step = toStep(slider, value);
  const set = (value: number) => {
    const next = fromStep(slider, value);
    onChange(slider.uiSpan ? Number(next.toFixed(3)) : round2(next));
  };
  return (
    <div className="grid grid-cols-[112px_1fr_24px] items-center gap-x-2 py-[3px]" title={slider.label}>
      <span className="text-gp-text text-[11px] leading-tight">{slider.ko}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="gp-step" aria-label={`Decrease ${slider.label}`} onClick={() => set(step - 1)}>−</button>
        <input type="range" min={-span} max={span} step={1} value={step} aria-label={slider.label}
          aria-valuetext={`${step} / ${span}`}
          style={{ ['--fill' as string]: `${((step + span) / (2 * span)) * 100}%` }}
          onChange={(event) => set(Number(event.target.value))} onDoubleClick={() => onChange(slider.def)} className="gp-range" />
        <button type="button" className="gp-step" aria-label={`Increase ${slider.label}`} onClick={() => set(step + 1)}>+</button>
      </div>
      <button type="button" onClick={() => onChange(slider.def)} title="Đặt lại" aria-label={`Reset ${slider.label}`}
        className={`text-right font-mono text-[10px] ${step !== 0 ? 'text-gp-hot' : 'text-gp-mute'}`}>
        {step}
      </button>
    </div>
  );
}
