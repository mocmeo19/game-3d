import { FaceSliders } from '../types/character';
import { DEFAULT_FACE, SKIN_TONES, HAIR_COLORS } from './presets';
import { ASSETS } from './assets';

const SHARED_HAIR = ASSETS.filter((a) => a.slot === 'hair' && a.genders.length === 2);
import { FACE_SLIDERS } from './sliders';

export interface DesignerPreset {
  id: string;
  face: FaceSliders;
  skinTone: string;
  hairStyle: string;
  hairColorPrimary: string;
  hairColorTips: string;
  lipColor: string;
}

const LIP_COLORS = ['#be185d', '#e11d48', '#c2410c', '#9d174d', '#b45309', '#a21caf'];

/** Small deterministic PRNG so the preset grid is identical on every load. */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 24 designer faces (6 × 4 grid, like the in-game "Mẫu thiết kế" list). */
export const DESIGNER_PRESETS: DesignerPreset[] = Array.from({ length: 24 }, (_, i) => {
  const rnd = mulberry32(1000 + i * 7919);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

  const face = { ...DEFAULT_FACE } as unknown as Record<string, number>;
  FACE_SLIDERS.forEach((s) => {
    const spread = (s.max - s.min) * 0.55;
    face[s.key] = Number(clamp(s.def + (rnd() - 0.5) * spread, s.min, s.max).toFixed(2));
  });

  return {
    id: `designer_${i + 1}`,
    face: face as unknown as FaceSliders,
    skinTone: pick(SKIN_TONES.slice(0, 6)).hex,
    hairStyle: pick(SHARED_HAIR).id,
    hairColorPrimary: pick(HAIR_COLORS).hex,
    hairColorTips: pick(HAIR_COLORS).hex,
    lipColor: pick(LIP_COLORS)
  };
});
