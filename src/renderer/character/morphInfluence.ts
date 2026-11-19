import { BODY_SLIDERS, DEFAULT_MORPH_GAIN, FACE_SLIDERS } from '../../constants/sliders';
import type { CharacterState } from '../../types/character';

const SLIDERS = [...FACE_SLIDERS, ...BODY_SLIDERS];

export function morphInfluence(state: CharacterState): Map<string, number> {
  const face = state.face as unknown as Record<string, number>;
  const body = state.body as unknown as Record<string, number>;
  const influence = new Map<string, number>();
  for (const slider of SLIDERS) {
    const value = face[slider.key] ?? body[slider.key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const positive = value >= slider.def;
    const range = positive ? slider.max - slider.def : slider.def - slider.min;
    if (!range) continue;
    const amount = Math.min(1, Math.abs(value - slider.def) / range) * (slider.morphGain ?? DEFAULT_MORPH_GAIN);
    if (amount > 0) influence.set(`${slider.key}_${positive ? 'pos' : 'neg'}`, amount);
  }
  return influence;
}
