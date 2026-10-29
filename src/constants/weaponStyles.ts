import type { WeaponKind } from '../types/character';
import { WEAPON_KINDS } from './weaponKinds';
import { WEAPON_MODELS } from './weaponModels';

/**
 * Forms of a weapon: the standard one, a heavy and a light form (size and metal), a glowing relic, and ready-made props
 * that replace the built weapon. The choice is saved as `weaponStyle`.
 */

export interface WeaponStyle {
  id: string;
  name: string;
  desc: string;
  /** Size of the whole weapon around the grip. */
  scale: number;
  metal: string;
  glow: string;
  metalness: number;
  roughness: number;
  /** A ready-made MPFB prop (constants/weaponModels.ts) held instead of the built weapon. */
  model?: string;
}

export const DEFAULT_WEAPON_STYLE = 'standard';

/** Metals of the heavy, light and relic forms. */
const PALETTE = { heavy: '#8a6a3a', light: '#d9b26a', glow: '#ff7a2b', relic: '#ffd27a', heavyName: 'đồng đỏ', lightName: 'vàng nhạt' };

/** Props that suit each weapon (every weapon may also be swapped for the everyday ones). */
const FOR_WEAPON: Partial<Record<WeaponKind, string[]>> = {
  curved_saber: ['crude_sword'],
  greatsword: ['crude_sword', 'war_hammer'],
  slender_sword: ['crude_sword'],
  twin_shortswords: ['crude_sword'],
  reverse_daggers: ['crude_sword'],
  great_axe: ['war_hammer', 'forge_hammer'],
  longbow: ['wooden_bow', 'short_bow'],
  spirit_revolvers: ['twin_pistols', 'm1911', 'akm', 'l1a1'],
  flower_staff: ['sceptre', 'kalistick'],
  talismans: ['sceptre', 'kalistick'],
  star_orb: ['sceptre', 'kalistick'],
  dragon_gauntlets: ['claws'],
  soul_gauntlets: ['claws'],
  chi_bangles: ['claws'],
  lute: ['guitar', 'microphone']
};
const EVERYDAY = ['racket', 'handbag', 'shopping_bag', 'sling_purse', 'suitcase', 'ivy_whip'];
export const FIREARM_MODELS: ReadonlySet<string> = new Set(['twin_pistols', 'm1911', 'akm', 'l1a1']);

export const weaponStyles = (weapon: WeaponKind): WeaponStyle[] => {
  const p = PALETTE;
  const base = WEAPON_KINDS[weapon].name;
  const modelIds = new Set([...(FOR_WEAPON[weapon] ?? []), ...FIREARM_MODELS, ...EVERYDAY]);
  const props: WeaponStyle[] = [...modelIds].flatMap((id) => {
    const m = WEAPON_MODELS.find((w) => w.id === id);
    return m ? [{ id: `m:${id}`, name: m.name, desc: `Mẫu MPFB · ${m.author}`, scale: 1, metal: '#e2e8f0', glow: '#38bdf8', metalness: 0.9, roughness: 0.18, model: id }] : [];
  });
  return [
    { id: 'standard', name: base, desc: 'Kiểu chuẩn.', scale: 1, metal: '#e2e8f0', glow: '#38bdf8', metalness: 0.9, roughness: 0.18 },
    { id: 'heavy', name: `${base} hạng nặng`, desc: `Lớn hơn, chế từ ${p.heavyName}.`, scale: 1.15, metal: p.heavy, glow: p.glow, metalness: 0.8, roughness: 0.35 },
    { id: 'light', name: `${base} thanh mảnh`, desc: `Gọn hơn, chế từ ${p.lightName}.`, scale: 0.9, metal: p.light, glow: p.glow, metalness: 0.95, roughness: 0.12 },
    { id: 'relic', name: `${base} · Thần khí`, desc: 'Thần khí phát sáng mạnh.', scale: 1.05, metal: p.relic, glow: p.glow, metalness: 1, roughness: 0.08 },
    ...props
  ];
};

export const weaponStyleOf = (weapon: WeaponKind, id?: string): WeaponStyle => {
  const all = weaponStyles(weapon);
  return all.find((s) => s.id === id) ?? all[0];
};
