import { getInitialCharacter } from '../constants/presets';
import { defaultOutfit } from '../constants/equipment';
import type { CharacterState, RaceType } from '../types/character';
import type { BodyModel, ModelSettings } from './modelSettings';

export function previewCharacter(
  slot: BodyModel, settings: ModelSettings, pose: CharacterState['pose'] = 'idle', skin?: string,
): CharacterState {
  const [race, gender] = slot.split('_') as [RaceType, 'female' | 'male'];
  const state = getInitialCharacter();
  return {
    ...state, race, gender, pose, skin, costume: defaultOutfit(gender), shoes: 'none',
    cosmetics: { ...state.cosmetics, hairStyle: 'short01' },
    gear: race === 'lyn' ? { tail: settings.lynFluffyTail } : {},
  };
}
