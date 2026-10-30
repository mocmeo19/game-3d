import { Info, Mic, Shirt, Sparkles, Swords, type LucideIcon } from 'lucide-react';

export type HomeNavTab = 'info' | 'outfit' | 'poses' | 'sound' | 'weapons';
/** `events` is opened from the event column, not from the bottom menu. */
export type HomeTab = HomeNavTab | 'events';

export const HOME_TABS: { id: HomeNavTab; label: string; Icon: LucideIcon }[] = [
  { id: 'info', label: 'Thông tin', Icon: Info },
  { id: 'outfit', label: 'Trang phục', Icon: Shirt },
  { id: 'poses', label: 'Tạo dáng', Icon: Sparkles },
  { id: 'sound', label: 'Giọng nói', Icon: Mic },
  { id: 'weapons', label: 'Vũ khí', Icon: Swords }
];

export const homeTabLabel = (tab: HomeTab): string =>
  tab === 'events' ? 'Sự kiện' : HOME_TABS.find((item) => item.id === tab)?.label ?? '';
