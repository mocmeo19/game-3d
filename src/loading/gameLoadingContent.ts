import type { GameKind } from '../components/UI/HomeScreen';

export interface GameLoadingContent {
  title: string;
  subtitle: string;
  accentClassName: string;
  glowColor: string;
  tips: readonly string[];
}

export const GAME_LOADING_CONTENT: Record<GameKind, GameLoadingContent> = {
  arena: {
    title: "Nam's Battle Royal",
    subtitle: 'Sinh tồn · Đấu đội với bot',
    accentClassName: 'bg-sky-300',
    glowColor: 'rgba(56, 189, 248, 0.28)',
    tips: [
      'Nhấn R để nạp đạn khi đã nấp an toàn.',
      'Nhấn V để đổi giữa góc nhìn thứ nhất và thứ ba.',
      'Sinh tồn: nhấn H để hồi máu, J để dùng đồ tăng lực.',
      'Sinh tồn: nhấn M để mở bản đồ lớn và tìm vùng an toàn.',
      'Đấu đội: nhấn B trong thời gian mua đồ để mở cửa hàng.'
    ]
  },
  torch: {
    title: 'Torchlight',
    subtitle: 'Action RPG · Chém quái',
    accentClassName: 'bg-amber-300',
    glowColor: 'rgba(251, 191, 36, 0.28)',
    tips: [
      'Nhấn K để mở bảng kỹ năng, Tab hoặc I để xem hành trang.',
      'Nhấn H để về thị trấn khi sắp hết máu.',
      'Phân rã trang bị thừa để nhận Tinh thạch cường hóa đồ tốt.',
      'Nhấn M để bật hoặc tắt bản đồ.'
    ]
  },
  testlab: {
    title: 'Test Nhân Vật',
    subtitle: 'Sân thử · Pose, vũ khí, parkour',
    accentClassName: 'bg-emerald-300',
    glowColor: 'rgba(52, 211, 153, 0.26)',
    tips: [
      'Kéo thả file .glb vào sân để thử vật thể của riêng bạn.',
      'Chọn tư thế trong danh sách để xem nhân vật tạo dáng ngay trên sân.',
      'Thử nằm, bò và leo để kiểm tra khung xương nhân vật.'
    ]
  }
};

export const LOADING_TIP_INTERVAL_MS = 4500;
