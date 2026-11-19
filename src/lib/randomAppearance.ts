import { assetsOf, skinsOf } from '../constants/equipment';
import { FACE_MARKINGS, HAIR_COLORS } from '../constants/presets';
import { BODY_SLIDERS, FACE_SLIDERS, type SliderDef } from '../constants/sliders';
import type { CharacterState, GenderType } from '../types/character';

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const rand = (min: number, span: number) => Number((min + Math.random() * span).toFixed(2));

/** Nudge every slider randomly around its default, staying inside its own range. */
const randomSet = <T extends object>(defs: SliderDef[], base: T): T => {
  const next = { ...base } as Record<string, number>;
  defs.forEach((d) => {
    const v = d.def + (Math.random() - 0.5) * (d.max - d.min) * 0.5;
    next[d.key] = Number(Math.min(d.max, Math.max(d.min, v)).toFixed(2));
  });
  return next as unknown as T;
};

/** Every slider at its default. */
const defaultSet = <T extends object>(defs: SliderDef[], base: T): T => {
  const next = { ...base } as Record<string, number>;
  defs.forEach((d) => {
    next[d.key] = d.def;
  });
  return next as unknown as T;
};

/** Ordinary people of the gender: young or middle-aged, no costume skins or fantasy colours. */
const NATURAL_SKIN = /^(young|middleage)_(asian|caucasian|african)_(male|female)$/;
const NATURAL_HAIR_COLORS = HAIR_COLORS.slice(0, 3);

export interface AppearanceOptions {
  /** A believable everyday person: natural skin and hair, default proportions, no face markings (bot squad mates). */
  natural?: boolean;
}

/** A random look (outfit, shoes, skin, body, face and hair) for a character of the given gender; everything else is kept. */
export function randomAppearance(state: CharacterState, gender: GenderType = state.gender, options: AppearanceOptions = {}): CharacterState {
  const natural = !!options.natural;
  const skins = skinsOf(gender).filter((x) =>
    natural ? NATURAL_SKIN.test(x.id) && x.gender === gender : x.id !== 'toon01' && !x.id.includes('special_suit') && !x.id.startsWith('old_')
  );
  const skin = pick(skins);
  const hairColors = natural ? NATURAL_HAIR_COLORS : HAIR_COLORS;
  return {
    ...state,
    gender,
    costume: pick(assetsOf('outfit', gender)).id,
    shoes: pick(assetsOf('shoes', gender)).id,
    skin: skin.id,
    body: natural ? defaultSet(BODY_SLIDERS, { ...state.body }) : randomSet(BODY_SLIDERS, { ...state.body }),
    face: randomSet(FACE_SLIDERS, { ...state.face }),
    cosmetics: {
      ...state.cosmetics,
      skinTone: skin.color,
      skinGloss: rand(0.4, 0.55),
      hairStyle: pick(assetsOf('hair', gender)).id,
      hairColorPrimary: pick(hairColors).hex,
      hairColorTips: pick(hairColors).hex,
      faceMarking: (natural ? 'none' : pick(FACE_MARKINGS).id) as CharacterState['cosmetics']['faceMarking'],
    },
  };
}
