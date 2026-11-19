import { Crosshair, MonitorCog, SlidersHorizontal, Volume2, type LucideIcon } from 'lucide-react';

export type SettingsTabId = 'basic' | 'graphics' | 'sensitivity' | 'audio';

export const SETTINGS_TABS: readonly { id: SettingsTabId; label: string; detail: string; Icon: LucideIcon }[] = [
  { id: 'basic', label: 'Cơ bản', detail: 'Góc nhìn & ngắm bắn', Icon: Crosshair },
  { id: 'graphics', label: 'Đồ họa', detail: 'Chất lượng & khung hình', Icon: MonitorCog },
  { id: 'sensitivity', label: 'Độ nhạy', detail: 'Chuột & ống ngắm', Icon: SlidersHorizontal },
  { id: 'audio', label: 'Âm thanh', detail: 'Nhạc & hiệu ứng', Icon: Volume2 },
];

export const settingsTabDomId = (id: SettingsTabId) => `game-settings-tab-${id}`;
export const SETTINGS_PANEL_DOM_ID = 'game-settings-panel';
