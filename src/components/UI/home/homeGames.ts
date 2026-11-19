import { Play, type LucideIcon } from 'lucide-react';
import type { MusicScene } from '../../../audio/ambientMusic';

export type GameKind = 'city';

export interface HomeGame {
  id: GameKind;
  name: string;
  mode: string;
  description: string;
  Icon: LucideIcon;
  /** Tailwind classes for the game's icon badge. */
  badgeClassName: string;
}

export const HOME_GAMES: HomeGame[] = [
  { id: 'city', name: 'Thành phố Thiên Lộc', mode: 'Thế giới mở · Cốt truyện', description: 'Khám phá thành phố · Lái xe · Nhiệm vụ', Icon: Play, badgeClassName: 'text-sky-100 bg-sky-500/25 border-sky-200/40' }
];

export const GAME_MUSIC_SCENE: Record<GameKind, MusicScene> = { city: 'arena' };

/** The open world has no shooter lobby: the character stands in the home screen's own pose. */
export const isShooterGame = (_id: GameKind): boolean => false;

export const homeGame = (id: GameKind): HomeGame => HOME_GAMES.find((game) => game.id === id) ?? HOME_GAMES[0];
