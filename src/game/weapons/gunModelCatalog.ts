import type { WeaponId } from '../rules';

/**
 * 3D models for the battle game's weapons (public/models/guns). A model is a whole file or one named root node of a file that
 * holds several weapons. Its fit (length, which way the barrel points, where the hand holds it) has defaults here and can be
 * corrected in Settings → Vũ khí (see gunModelSettings.ts).
 */

/** `barrel`: the longest side is the barrel (guns, knives). `upright`: the longest side stands up (grenades). */
export type GunModelShape = 'barrel' | 'upright';

export interface GunModelFit {
  /** Real length of the longest side (m). */
  length: number;
  /** The automatic orientation put the muzzle at the back: turn it round. */
  flipBarrel: boolean;
  /** The automatic orientation put the grip on top: turn it upside down. */
  flipUp: boolean;
  /** Where the hand holds it, from the back (0) to the front (1) of the model. */
  gripAlong: number;
  /** Height of the hold, from the bottom (0) to the top (1). */
  gripHeight: number;
  /** Height of the muzzle at the front end, from the bottom (0) to the top (1). */
  muzzleHeight: number;
  /** Where the other hand holds it (the handguard of a rifle, under the grip of a pistol), back (0) to front (1). */
  supportAlong: number;
  /** Height of the other hand, bottom (0) to top (1). */
  supportHeight: number;
}

export interface GunModelDef {
  id: string;
  label: string;
  file: string;
  /** Root node of the file to use; the whole scene when absent. */
  node?: string;
  shape: GunModelShape;
  /** The file has no material: give it plain gun metal. */
  plainMetal?: boolean;
  source: string;
  fit: GunModelFit;
}

const fit = (length: number, extra: Partial<GunModelFit> = {}): GunModelFit => ({
  length, flipBarrel: false, flipUp: false, gripAlong: 0.35, gripHeight: 0.45, muzzleHeight: 0.7, supportAlong: 0.68, supportHeight: 0.35,
  ...extra,
});
const PISTOL = { gripAlong: 0.25, gripHeight: 0.6, muzzleHeight: 0.85, supportAlong: 0.2, supportHeight: 0.3 };
const BLADE = { gripAlong: 0.15, gripHeight: 0.5, muzzleHeight: 0.5 };
const GRENADE = { gripAlong: 0.5, gripHeight: 0.4, muzzleHeight: 0.9 };

export const GUN_MODELS: readonly GunModelDef[] = [
  { id: 'ak47-realistic', label: 'AK-47 (thực tế)', file: 'ak47.glb', shape: 'barrel', plainMetal: true, source: 'AK47_LOD0.glb', fit: fit(0.88, { flipBarrel: true }) },
  { id: 'm4a1-realistic', label: 'M4A1 (thực tế)', file: 'm4a1.glb', shape: 'barrel', source: 'M4A1.glb', fit: fit(0.84, { flipBarrel: true }) },
  { id: 'sniper-realistic', label: 'Súng bắn tỉa (thực tế)', file: 'sniper.glb', shape: 'barrel', source: 'Sniper.glb', fit: fit(1.2) },
  { id: 'bren', label: 'Súng máy Bren', file: 'bren.glb', shape: 'barrel', source: 'czbren2.glb', fit: fit(1.15) },
  { id: 'gunspack-m4a1', label: 'M4A1 (gunspack)', file: 'gunspack.glb', node: 'M4A1 Assault Rifle', shape: 'barrel', source: 'gunspack.glb', fit: fit(0.84) },
  { id: 'gunspack-pistol', label: 'Súng lục (gunspack)', file: 'gunspack.glb', node: 'Pistol', shape: 'barrel', source: 'gunspack.glb', fit: fit(0.21, PISTOL) },
  { id: 'gunspack-knife', label: 'Dao chiến đấu (gunspack)', file: 'gunspack.glb', node: 'Combat_Knife', shape: 'barrel', source: 'gunspack.glb', fit: fit(0.3, BLADE) },
  { id: 'gunspack-grenade', label: 'Lựu đạn nổ (gunspack)', file: 'gunspack.glb', node: 'grenade_body', shape: 'upright', source: 'gunspack.glb', fit: fit(0.11, GRENADE) },
  { id: 'gunspack-smoke', label: 'Lựu đạn khói (gunspack)', file: 'gunspack.glb', node: 'Smoke_bomb', shape: 'upright', source: 'gunspack.glb', fit: fit(0.14, GRENADE) },
  { id: 'stylized-rifle', label: 'Súng trường (low-poly)', file: 'stylized-weapons.glb', node: 'rifle_001', shape: 'barrel', source: 'Weapons_Free_glb.zip', fit: fit(0.9) },
  { id: 'stylized-sniper', label: 'Súng bắn tỉa (low-poly)', file: 'stylized-weapons.glb', node: 'sniper_rifle_001', shape: 'barrel', source: 'Weapons_Free_glb.zip', fit: fit(1.15) },
  { id: 'stylized-shotgun', label: 'Súng shotgun (low-poly)', file: 'stylized-weapons.glb', node: 'shotgun_001', shape: 'barrel', source: 'Weapons_Free_glb.zip', fit: fit(1) },
  { id: 'stylized-pistol', label: 'Súng lục (low-poly)', file: 'stylized-weapons.glb', node: 'pistol_001', shape: 'barrel', source: 'Weapons_Free_glb.zip', fit: fit(0.24, PISTOL) },
  { id: 'stylized-knife', label: 'Dao (low-poly)', file: 'stylized-weapons.glb', node: 'knife_001', shape: 'barrel', source: 'Weapons_Free_glb.zip', fit: fit(0.28, BLADE) },
  { id: 'apocalypse-pistol', label: 'Súng lục (Apocalypse)', file: 'apocalypse-pistol.glb', shape: 'barrel', source: 'Apocalypse_Free_glb.zip', fit: fit(0.21, PISTOL) },
  { id: 'katana', label: 'Katana (Apocalypse)', file: 'katana.glb', shape: 'barrel', source: 'Apocalypse_Free_glb.zip', fit: fit(0.95, { ...BLADE, gripAlong: 0.12 }) },
];

const BY_ID = new Map(GUN_MODELS.map((model) => [model.id, model]));
export const gunModel = (id: string): GunModelDef | undefined => BY_ID.get(id);

/** Which model each weapon uses on a fresh install; null keeps the built-in box model. */
export const DEFAULT_GUN_ASSIGNMENTS: Record<WeaponId, string | null> = {
  ak47: 'ak47-realistic', m4a4: 'm4a1-realistic', awp: 'sniper-realistic', mp9: null,
  deagle: 'gunspack-pistol', usp: 'gunspack-pistol', glock: 'gunspack-pistol', knife: 'gunspack-knife',
  he: 'gunspack-grenade', smoke: 'gunspack-smoke', flash: 'gunspack-smoke',
};

export const gunModelUrl = (file: string) => `/models/guns/${file}`;
