import type { CharacterState } from '../../../types/character';
import type { WeaponId } from '../../core/rules';
import type { PlaceId } from '../map/cityPlaces';

/** The three people the story is told through; the player switches between them like in a crime saga. */
export type ProtagonistId = 'kha' | 'tu' | 'lam';

export interface Protagonist {
  id: ProtagonistId;
  name: string;
  role: string;
  /** Outfit colours over the player's character, so each one is told apart at a glance. */
  outfitMain: string;
  outfitAccent: string;
  home: PlaceId;
  startMoney: number;
  startWeapons: readonly WeaponId[];
  /** Mission that brings them into the story (null: playable from the start). */
  joinsAfter: string | null;
}

export const PROTAGONIST_ORDER: readonly ProtagonistId[] = ['kha', 'tu', 'lam'];

export const PROTAGONISTS: Record<ProtagonistId, Protagonist> = {
  kha: {
    id: 'kha', name: 'Kha', role: 'Tay lái thuê', outfitMain: '#2d3e56', outfitAccent: '#c9a25b',
    home: 'hideout', startMoney: 400, startWeapons: ['glock'], joinsAfter: null,
  },
  tu: {
    id: 'tu', name: 'Tú', role: 'Tin tặc', outfitMain: '#3b2a4f', outfitAccent: '#42d6c4',
    home: 'vyLoft', startMoney: 1200, startWeapons: ['usp'], joinsAfter: 'm2-debt',
  },
  lam: {
    id: 'lam', name: 'Lâm', role: 'Cựu lính đánh thuê', outfitMain: '#46503a', outfitAccent: '#8b3a2b',
    home: 'pawnShop', startMoney: 2500, startWeapons: ['deagle', 's12k'], joinsAfter: 'm4-hot-cargo',
  },
};

/** The player's character dressed as a protagonist (their body and face stay the player's own). */
export function protagonistLook(base: CharacterState, id: ProtagonistId): CharacterState {
  const hero = PROTAGONISTS[id];
  return { ...base, cosmetics: { ...base.cosmetics, outfitMain: hero.outfitMain, outfitAccent: hero.outfitAccent, wearColors: {} } };
}

export const isUnlocked = (id: ProtagonistId, completed: ReadonlySet<string>) => {
  const after = PROTAGONISTS[id].joinsAfter;
  return after === null || completed.has(after);
};
