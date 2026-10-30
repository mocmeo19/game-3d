import { Flame, FlaskConical, Play, type LucideIcon } from 'lucide-react';

export type GameKind = 'arena' | 'torch' | 'testlab';

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
  { id: 'arena', name: "Nam's Battle Royal", mode: 'Đấu trường sinh tồn', description: 'Sinh tồn · Đấu đội với bot', Icon: Play, badgeClassName: 'text-sky-100 bg-sky-500/25 border-sky-200/40' },
  { id: 'torch', name: 'Torchlight', mode: 'Hành trình chém quái', description: 'Action RPG · Chém quái', Icon: Flame, badgeClassName: 'text-amber-100 bg-amber-500/25 border-amber-200/40' },
  { id: 'testlab', name: 'Test Nhân Vật', mode: 'Sân thử nghiệm', description: 'Sân thử · Pose, vũ khí, parkour', Icon: FlaskConical, badgeClassName: 'text-emerald-100 bg-emerald-500/25 border-emerald-200/40' }
];

export const homeGame = (id: GameKind): HomeGame => HOME_GAMES.find((game) => game.id === id) ?? HOME_GAMES[0];
