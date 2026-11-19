import type { GameKind } from '../components/UI/home/homeGames';

export interface MatchmakingContent {
  /** Shown big on the mode card, with the view in brackets. */
  modeName: string;
  perspective: 'TPP' | 'FPP';
  mapName: string;
  /** Picture behind the mode card (none: a tinted gradient). */
  mapImage?: string;
  /** Players in a full lobby, the player included. */
  capacity: number;
  /** The player and their bot squad mates standing in the lobby. */
  squadSize: number;
}

/** The lobby of the two shooter games (everyone else in the match is a bot). */
export const MATCHMAKING_CONTENT: Partial<Record<GameKind, MatchmakingContent>> = {
};

/** "mm:ss" for a duration in milliseconds. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
