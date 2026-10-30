import { Crosshair, Flame, Gift, Shirt, type LucideIcon } from 'lucide-react';
import type { GameKind } from './homeGames';

export type GameEventAction =
  | { kind: 'play'; game: GameKind }
  | { kind: 'open-outfit' }
  | { kind: 'top-up' };

export interface GameEvent {
  id: string;
  title: string;
  tagline: string;
  description: string;
  /** Last day of the event, local time, as YYYY-MM-DD. */
  endsOn: string;
  gradientFrom: string;
  gradientTo: string;
  Icon: LucideIcon;
  action: GameEventAction;
  actionLabel: string;
}

export const TOP_UP_EVENT_ID = 'top-up-bonus';

export const GAME_EVENTS: readonly GameEvent[] = [
  {
    id: 'arena-week', title: 'Tuần lễ Xạ thủ', tagline: 'Đấu trường sinh tồn',
    description: 'Vào Đấu trường sinh tồn và trụ lại đến người cuối cùng. Mỗi trận nhận Vàng theo số hạ gục và thứ hạng.',
    endsOn: '2026-11-15', gradientFrom: '#c0392b', gradientTo: '#2a0d0b', Icon: Crosshair,
    action: { kind: 'play', game: 'arena' }, actionLabel: 'Chơi ngay'
  },
  {
    id: 'torch-night', title: 'Đêm Đuốc Thiêng', tagline: 'Hành trình chém quái',
    description: 'Thắp đuốc, băng qua các vùng đất và hạ quái. Mỗi con quái hạ được cộng thêm Vàng.',
    endsOn: '2026-11-30', gradientFrom: '#d9822b', gradientTo: '#2b1606', Icon: Flame,
    action: { kind: 'play', game: 'torch' }, actionLabel: 'Chơi ngay'
  },
  {
    id: 'fashion-fest', title: 'Lễ hội Thời trang', tagline: 'Phối đồ trên sảnh',
    description: 'Phối bộ trang phục mới cho nhân vật rồi khoe tạo dáng ngay trên sảnh chờ.',
    endsOn: '2026-12-10', gradientFrom: '#8e44ad', gradientTo: '#1d0b26', Icon: Shirt,
    action: { kind: 'open-outfit' }, actionLabel: 'Phối đồ'
  },
  {
    id: TOP_UP_EVENT_ID, title: 'Ưu đãi Kim cương', tagline: 'Tặng thêm Kim cương',
    description: 'Các gói từ 300 Kim cương trở lên được tặng thêm, gói 6.000 Kim cương tặng thêm 1.200 Kim cương.',
    endsOn: '2026-12-31', gradientFrom: '#e0a800', gradientTo: '#2b2102', Icon: Gift,
    action: { kind: 'top-up' }, actionLabel: 'Nạp ngay'
  }
];

const MS_PER_DAY = 86_400_000;

/** Whole days left until the end of `endsOn` (0 on the last day, negative once over). */
export function daysLeft(event: GameEvent, now: Date): number {
  const [year, month, day] = event.endsOn.split('-').map(Number);
  const endOfLastDay = new Date(year, month - 1, day + 1).getTime();
  return Math.ceil((endOfLastDay - now.getTime()) / MS_PER_DAY) - 1;
}

export const activeGameEvents = (now: Date): GameEvent[] => GAME_EVENTS.filter((event) => daysLeft(event, now) >= 0);

export function timeLeftLabel(event: GameEvent, now: Date): string {
  const days = daysLeft(event, now);
  return days === 0 ? 'Kết thúc hôm nay' : `Còn ${days} ngày`;
}
