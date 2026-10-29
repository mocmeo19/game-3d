import type { LabWeapon } from './TestLabEngine';

export const LAB_WEAPONS: { id: LabWeapon; label: string }[] = [
  { id: 'none', label: 'Tay không' },
  { id: 'class', label: 'Vũ khí lớp' },
  { id: 'knife', label: 'Dao' },
  { id: 'usp', label: 'Súng ngắn' },
  { id: 'deagle', label: 'Deagle' },
  { id: 'mp9', label: 'Tiểu liên' },
  { id: 'ak47', label: 'AK-47' },
  { id: 'm4a4', label: 'M4A4' },
  { id: 'awp', label: 'Bắn tỉa' },
  { id: 'he', label: 'Lựu đạn' }
];

export const LAB_ZONES: { id: string; label: string; at: [number, number]; heading: number }[] = [
  { id: 'center', label: 'Giữa sân', at: [0, -20], heading: 0 },
  { id: 'parkour', label: 'Bãi parkour', at: [-14, -14], heading: 0 },
  { id: 'props', label: 'Khu vật thể', at: [12, -14], heading: 0 },
  { id: 'range', label: 'Bãi bắn', at: [0, 4], heading: 0 }
];

