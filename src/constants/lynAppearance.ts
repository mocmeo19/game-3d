import { getModelSettings } from '../settings/modelSettings';
import type { CharacterState } from '../types/character';

export function lynTailModel(state: CharacterState): string | null {
  if (state.race !== 'lyn') return null;
  const settings = getModelSettings();
  return state.cosmetics.tailType === 'cat_slender' ? settings.lynSlenderTail : settings.lynFluffyTail;
}

export function tailColor(state: CharacterState, modelColor?: string): string {
  const cosmetics = state.cosmetics;
  return cosmetics.wearColors?.tail
    || (state.race === 'lyn' ? cosmetics.furColorPrimary : cosmetics.outfitAccent)
    || modelColor || '#4a4a4f';
}
