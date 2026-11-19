import type { SliderDef } from '../../constants/sliders';

export const round2 = (value: number) => Number(value.toFixed(2));
export const sliderSpan = (slider: SliderDef) => slider.uiSpan ?? 20;

export function toStep(slider: SliderDef, value: number): number {
  const span = sliderSpan(slider);
  const distance = value >= slider.def ? slider.max - slider.def : slider.def - slider.min;
  if (!distance || !Number.isFinite(value)) return 0;
  return Math.round(Math.max(-span, Math.min(span, (value - slider.def) / distance * span)));
}

export function fromStep(slider: SliderDef, step: number): number {
  const amount = Math.max(-sliderSpan(slider), Math.min(sliderSpan(slider), step));
  const distance = amount >= 0 ? slider.max - slider.def : slider.def - slider.min;
  return slider.def + amount / sliderSpan(slider) * distance;
}
