const MATCH_BASE_GOLD = 20;
const GOLD_PER_KILL = 10;
const TEAM_WIN_BONUS_GOLD = 50;
const ROYALE_WIN_BONUS_GOLD = 100;
const ROYALE_TOP_QUARTER_BONUS_GOLD = 40;
export const TORCH_GOLD_PER_KILL = 2;

export interface TeamMatchResult {
  kills: number;
  isWin: boolean;
}

export interface RoyaleMatchResult {
  kills: number;
  placement: number;
  playerCount: number;
}

const killGold = (kills: number): number => Math.max(0, Math.floor(kills)) * GOLD_PER_KILL;

export const teamMatchGold = ({ kills, isWin }: TeamMatchResult): number =>
  MATCH_BASE_GOLD + killGold(kills) + (isWin ? TEAM_WIN_BONUS_GOLD : 0);

export function royaleMatchGold({ kills, placement, playerCount }: RoyaleMatchResult): number {
  const placementBonus = placement === 1
    ? ROYALE_WIN_BONUS_GOLD
    : placement <= Math.ceil(playerCount / 4) ? ROYALE_TOP_QUARTER_BONUS_GOLD : 0;
  return MATCH_BASE_GOLD + killGold(kills) + placementBonus;
}
