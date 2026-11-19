import type { GameKind } from '../components/UI/HomeScreen';

export interface GameLoadingContent {
  title: string;
  subtitle: string;
  accentClassName: string;
  glowColor: string;
  tips: readonly string[];
}

export const GAME_LOADING_CONTENT: Record<GameKind, GameLoadingContent> = {
  city: {
    title: 'Thành phố Thiên Lộc',
    subtitle: 'Thế giới mở · Cốt truyện',
    accentClassName: 'bg-amber-300',
    glowColor: 'rgba(251, 191, 36, 0.24)',
    tips: [
      'Nhấn F cạnh một chiếc xe để lên xe, F lần nữa để xuống.',
      'Nhấn M để mở bản đồ và bấm vào một điểm để đặt chỉ đường.',
      'Cắt đuôi cảnh sát: ra khỏi tầm nhìn và rời khỏi vùng tìm kiếm.',
      'Nhấn Tab để đổi giữa Kha, Tú và Lâm khi không làm nhiệm vụ.'
    ]
  },
};

export const LOADING_TIP_INTERVAL_MS = 4500;
