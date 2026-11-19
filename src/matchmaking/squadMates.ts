import { randomAppearance } from '../lib/randomAppearance';
import type { SquadMate } from '../renderer/squadLineup';
import type { CharacterState, GenderType } from '../types/character';

/** The bots on the player's side in 5 vs 5 carry these names in the match too. */
const MATE_NAMES = ['Hải', 'Long', 'Minh', 'Tuấn'];
const MATE_GENDERS: GenderType[] = ['male', 'female', 'male', 'female'];

/** Bot squad mates for the lobby: each a random look of the stage character, posed the same way and holding the same gun. */
export function makeSquadMates(stage: CharacterState, count: number): SquadMate[] {
  return MATE_NAMES.slice(0, Math.max(0, count)).map((name, index) => ({
    key: `mate-${index}-${name}`,
    name,
    role: 'Thành viên',
    ready: true,
    state: { ...randomAppearance(stage, MATE_GENDERS[index], { natural: true }), name },
  }));
}
