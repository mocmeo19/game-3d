import { Crosshair, Gift, Shirt, type LucideIcon } from 'lucide-react';
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
  category: 'activity' | 'style' | 'offers';
  image: string;
  headline: string;
  instructions: readonly string[];
}

export type EventCategory = 'all' | GameEvent['category'];

export const EVENT_CATEGORIES: { id: EventCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'activity', label: 'Hoạt động' },
  { id: 'style', label: 'Phong cách' },
  { id: 'offers', label: 'Ưu đãi' }
];

export const TOP_UP_EVENT_ID = 'top-up-bonus';

export const GAME_EVENTS: readonly GameEvent[] = [
  {
    id: 'city-opening', title: 'Khai trương Thiên Lộc', tagline: 'Thế giới mở',
    description: 'Khám phá thành phố Thiên Lộc cùng Kha, Tú và Lâm: lái xe, làm nhiệm vụ cốt truyện và cắt đuôi cảnh sát.',
    endsOn: '2026-11-15', gradientFrom: '#c0392b', gradientTo: '#2a0d0b', Icon: Crosshair,
    action: { kind: 'play', game: 'city' }, actionLabel: 'Vào thành phố',
    category: 'activity', image: '/loading/battle-royale-dusk.jpg', headline: 'THÀNH PHỐ CỦA BẠN',
    instructions: ['Bấm Bắt đầu để vào thành phố.', 'Tìm các điểm nhiệm vụ có chữ cái của nhân vật trên bản đồ (M).', 'Nhấn Tab để đổi nhân vật khi họ đã tham gia câu chuyện.']
  },
  {
    id: 'fashion-fest', title: 'Lễ hội Thời trang', tagline: 'Phối đồ trên sảnh',
    description: 'Phối bộ trang phục mới cho nhân vật rồi khoe tạo dáng ngay trên sảnh chờ.',
    endsOn: '2026-12-10', gradientFrom: '#8e44ad', gradientTo: '#1d0b26', Icon: Shirt,
    action: { kind: 'open-outfit' }, actionLabel: 'Phối đồ ngay',
    category: 'style', image: '/backdrops/flat/pubg_aircraft.jpg', headline: 'DẤU ẤN CỦA BẠN',
    instructions: ['Mở Trang phục để chọn bộ đồ đang có.', 'Kết hợp trang phục, giày và phụ kiện theo phong cách riêng.', 'Bấm Lưu trang phục để giữ lại lựa chọn cho nhân vật.']
  },
  {
    id: TOP_UP_EVENT_ID, title: 'Ưu đãi Kim cương', tagline: 'Tặng thêm Kim cương',
    description: 'Các gói từ 300 Kim cương trở lên được tặng thêm, gói 6.000 Kim cương tặng thêm 1.200 Kim cương.',
    endsOn: '2026-12-31', gradientFrom: '#e0a800', gradientTo: '#2b2102', Icon: Gift,
    action: { kind: 'top-up' }, actionLabel: 'Xem gói Kim cương',
    category: 'offers', image: '/backdrops/flat/pubg_containers.jpg', headline: 'THÊM KC. THÊM LỰA CHỌN.',
    instructions: ['Mở danh sách gói để xem giá và số Kim cương tặng kèm.', 'Kiểm tra tổng Kim cương trước khi xác nhận.', 'Nạp Kim cương hiện ở chế độ thử nghiệm, không thu tiền thật.']
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
