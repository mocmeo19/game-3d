import type { GunGrip } from '../aim/aimModes';
import type { WeaponId } from '../rules';

/** What kind of gun each weapon is: drives how it is held, how bots use it and how it is labelled. */
export type GunClass = 'pistol' | 'smg' | 'rifle' | 'lmg' | 'dmr' | 'sniper' | 'shotgun';

export const GUN_CLASS: Partial<Record<WeaponId, GunClass>> = {
  glock: 'pistol',
  usp: 'pistol',
  deagle: 'pistol',
  mp9: 'smg',
  ump: 'smg',
  s12k: 'shotgun',
  ak47: 'rifle',
  m4a4: 'rifle',
  scar: 'rifle',
  m249: 'lmg',
  sks: 'dmr',
  awp: 'sniper',
  kar98: 'sniper',
};

export const GUN_CLASS_LABEL: Record<GunClass, string> = {
  pistol: 'Súng lục',
  smg: 'Tiểu liên',
  rifle: 'Súng trường',
  lmg: 'Súng máy',
  dmr: 'Súng trường bắn tỉa',
  sniper: 'Bắn tỉa',
  shotgun: 'Shotgun',
};

/** Better primaries rank higher when bots decide whether to swap. */
export const GUN_TIER: Partial<Record<WeaponId, number>> = {
  glock: 1, usp: 1, deagle: 2, mp9: 2, ump: 2, s12k: 2, ak47: 3, m4a4: 3, scar: 3, m249: 3, sks: 3, awp: 3, kar98: 3,
};

/** Long guns aimed through a scope, for the hold pose and for bots that scope in before a shot. */
export const isScopedGun = (id: WeaponId): boolean => GUN_CLASS[id] === 'sniper' || GUN_CLASS[id] === 'dmr';

export function gripOfGun(id: WeaponId): GunGrip {
  const gunClass = GUN_CLASS[id];
  if (gunClass === 'pistol') return 'pistol';
  if (gunClass === 'smg') return 'smg';
  if (isScopedGun(id)) return 'sniper';
  return 'rifle';
}
