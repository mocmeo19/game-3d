import type { GameKind } from '../components/UI/HomeScreen';

const LAST_GAME_KEY = 'bns.last-played-game.v1';

export function loadLastPlayedGame(): GameKind {
  try {
    const saved = localStorage.getItem(LAST_GAME_KEY);
    if (saved === 'city') return saved;
    return 'city';
  } catch {
    return 'city';
  }
}

export function saveLastPlayedGame(game: GameKind): void {
  try {
    localStorage.setItem(LAST_GAME_KEY, game);
  } catch {
    // Remembering the last game is optional when browser storage is unavailable.
  }
}
