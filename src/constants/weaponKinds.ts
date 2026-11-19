import type { WeaponKind } from '../types/character';

export interface WeaponKindInfo {
  id: WeaponKind;
  name: string;
  description: string;
  badge: string;
  color: string;
}

export const WEAPON_KINDS: Record<WeaponKind, WeaponKindInfo> = {
  curved_saber: { id: 'curved_saber', name: 'Đao cong', badge: '⚔️', color: '#e59b27', description: 'Đao một lưỡi, chém nhanh và chém bổ từ trên xuống.' },
  chi_bangles: { id: 'chi_bangles', name: 'Vòng khí và dải lụa bay', badge: '🔮', color: '#3498db', description: 'Hai vòng khí băng và lửa trên cổ tay để tung chưởng từ xa.' },
  great_axe: { id: 'great_axe', name: 'Rìu khổng lồ', badge: '🪓', color: '#9b59b6', description: 'Rìu hai tay nặng nề, đập xuống đất và bổ mạnh.' },
  reverse_daggers: { id: 'reverse_daggers', name: 'Đoản đao lưỡi liềm ngược', badge: '🗡️', color: '#2ecc71', description: 'Đôi đoản đao cầm ngược để đâm và chém sát người.' },
  flower_staff: { id: 'flower_staff', name: 'Trượng hoa thiên nhiên', badge: '🌻', color: '#f39c12', description: 'Trượng gỗ nở hoa dùng để triệu hồi linh thú.' },
  spirit_revolvers: { id: 'spirit_revolvers', name: 'Súng lục ma công đôi', badge: '🔫', color: '#e74c3c', description: 'Đôi súng lục bắn loạt đạn ma công.' },
  slender_sword: { id: 'slender_sword', name: 'Trường kiếm mảnh', badge: '🌙', color: '#8b5cf6', description: 'Kiếm dài và nhẹ cho những đường xoay kiếm uyển chuyển.' },
  talismans: { id: 'talismans', name: 'Bùa ấn và linh thư', badge: '🕯️', color: '#9333ea', description: 'Xấp bùa ấn một tay, linh thư tay kia để niệm chú.' },
  soul_gauntlets: { id: 'soul_gauntlets', name: 'Găng khí hồn', badge: '✋', color: '#14b8a6', description: 'Găng tụ hồn khí, vừa tung chưởng vừa đấm cận chiến.' },
  greatsword: { id: 'greatsword', name: 'Đại kiếm', badge: '🛡️', color: '#0ea5e9', description: 'Kiếm lớn hai lưỡi cho những nhát chém quét nặng.' },
  longbow: { id: 'longbow', name: 'Trường cung', badge: '🏹', color: '#22c55e', description: 'Cung dài kéo căng dây để bắn từ xa.' },
  star_orb: { id: 'star_orb', name: 'Tinh cầu', badge: '✨', color: '#f59e0b', description: 'Quả cầu sao lơ lửng gọi mưa sao băng.' },
  twin_shortswords: { id: 'twin_shortswords', name: 'Song đoản kiếm', badge: '🗡️', color: '#ef4444', description: 'Hai thanh kiếm ngắn xoay chém liên hoàn.' },
  lute: { id: 'lute', name: 'Đàn huyền cầm', badge: '🎵', color: '#ec4899', description: 'Cây đàn gảy những khúc nhạc mang nội lực.' }
};

export const WEAPON_KIND_LIST: WeaponKindInfo[] = Object.values(WEAPON_KINDS);
export const DEFAULT_WEAPON_KIND: WeaponKind = 'curved_saber';

export const isWeaponKind = (value: unknown): value is WeaponKind =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(WEAPON_KINDS, value);

/** Characters saved before weapons were picked directly stored a class; each class carried exactly one of these weapons. */
const LEGACY_CLASS_WEAPONS: Record<string, WeaponKind> = {
  blade_master: 'curved_saber',
  force_master: 'chi_bangles',
  destroyer: 'great_axe',
  assassin: 'reverse_daggers',
  summoner: 'flower_staff',
  gunslinger: 'spirit_revolvers',
  blade_dancer: 'slender_sword',
  warlock: 'talismans',
  soul_fighter: 'soul_gauntlets',
  warden: 'greatsword',
  archer: 'longbow',
  astromancer: 'star_orb',
  dual_blade: 'twin_shortswords',
  musician: 'lute'
};

export const weaponKindFromLegacyClass = (characterClass: unknown): WeaponKind | undefined =>
  typeof characterClass === 'string' ? LEGACY_CLASS_WEAPONS[characterClass] : undefined;
