import { getInitialCharacter } from '../constants/presets';
import { defaultOutfit } from '../constants/equipment';
import type { CharacterState, GenderType } from '../types/character';

export function previewCharacter(gender: GenderType, pose: CharacterState['pose'] = 'idle', skin?: string): CharacterState {
  const state = getInitialCharacter();
  return {
    ...state, gender, pose, skin, costume: defaultOutfit(gender), shoes: 'none',
    cosmetics: { ...state.cosmetics, hairStyle: 'short01' },
    gear: {},
  };
}
