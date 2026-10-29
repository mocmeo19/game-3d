import { ClassType, RaceType } from '../types/character';
import { CLASSES } from './presets';
import { WEAPON_MODELS } from './weaponModels';

/**
 * Weapon choices of the class step. A class has one weapon model; each race offers four forms of it: the standard one, a heavy
 * and a light form (size and metal of the race) and the race's relic (its own glow). The choice is saved as `weaponStyle`.
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
  /** A ready-made MPFB prop (constants/weaponModels.ts) held instead of the class weapon. */
  model?: string;
}

export const DEFAULT_WEAPON_STYLE = 'standard';

interface RacePalette {
  heavy: string;
  light: string;
  glow: string;
  relic: string;
  relicName: string;
  heavyName: string;
  lightName: string;
}

const PALETTE: Record<RaceType, RacePalette> = {
  jin: { heavy: '#8a6a3a', light: '#d9b26a', glow: '#ff7a2b', relic: '#ffd27a', relicName: 'Thần khí Jin', heavyName: 'đồng đỏ', lightName: 'vàng nhạt' },
  gon: { heavy: '#4b535e', light: '#9aa5b1', glow: '#8bd13b', relic: '#bfe36a', relicName: 'Thần khí Gon', heavyName: 'thép đen', lightName: 'thép xám' },
  lyn: { heavy: '#9aa7c0', light: '#e6ecf8', glow: '#f472b6', relic: '#f9a8d4', relicName: 'Thần khí Lyn', heavyName: 'bạc cổ', lightName: 'bạc trắng' },
  yun: { heavy: '#4fae8f', light: '#9be3c8', glow: '#a78bfa', relic: '#c4b5fd', relicName: 'Thần khí Yun', heavyName: 'ngọc lục', lightName: 'ngọc nhạt' }
};

/** Props that suit each class (every class may also carry the everyday ones). */
const FOR_CLASS: Partial<Record<ClassType, string[]>> = {
  blade_master: ['crude_sword'],
  warden: ['crude_sword', 'war_hammer'],
  blade_dancer: ['crude_sword'],
  dual_blade: ['crude_sword'],
  assassin: ['crude_sword'],
  destroyer: ['war_hammer', 'forge_hammer'],
  archer: ['wooden_bow', 'short_bow'],
  gunslinger: ['twin_pistols', 'm1911', 'akm', 'l1a1'],
  summoner: ['sceptre', 'kalistick'],
  warlock: ['sceptre', 'kalistick'],
  astromancer: ['sceptre', 'kalistick'],
  kung_fu_master: ['claws'],
  soul_fighter: ['claws'],
  force_master: ['claws'],
  musician: ['guitar', 'microphone']
};
const EVERYDAY = ['racket', 'handbag', 'shopping_bag', 'sling_purse', 'suitcase', 'ivy_whip'];
export const FIREARM_MODELS: ReadonlySet<string> = new Set(['twin_pistols', 'm1911', 'akm', 'l1a1']);

export const weaponStyles = (race: RaceType, cls: ClassType): WeaponStyle[] => {
  const p = PALETTE[race];
  const base = CLASSES[cls].weaponName;
  const modelIds = new Set([...(FOR_CLASS[cls] ?? []), ...FIREARM_MODELS, ...EVERYDAY]);
  const props: WeaponStyle[] = [...modelIds].flatMap((id) => {
    const m = WEAPON_MODELS.find((w) => w.id === id);
    return m ? [{ id: `m:${id}`, name: m.name, desc: `Mẫu MPFB · ${m.author}`, scale: 1, metal: '#e2e8f0', glow: '#38bdf8', metalness: 0.9, roughness: 0.18, model: id }] : [];
  });
  return [
    { id: 'standard', name: base, desc: 'Kiểu chuẩn của lớp.', scale: 1, metal: '#e2e8f0', glow: '#38bdf8', metalness: 0.9, roughness: 0.18 },
    { id: 'heavy', name: `${base} hạng nặng`, desc: `Lớn hơn, chế từ ${p.heavyName}.`, scale: 1.15, metal: p.heavy, glow: p.glow, metalness: 0.8, roughness: 0.35 },
    { id: 'light', name: `${base} thanh mảnh`, desc: `Gọn hơn, chế từ ${p.lightName}.`, scale: 0.9, metal: p.light, glow: p.glow, metalness: 0.95, roughness: 0.12 },
    { id: 'relic', name: `${base} · ${p.relicName}`, desc: 'Thần khí riêng của chủng tộc, phát sáng mạnh.', scale: 1.05, metal: p.relic, glow: p.glow, metalness: 1, roughness: 0.08 },
    ...props
  ];
};

export const weaponStyleOf = (race: RaceType, cls: ClassType, id?: string): WeaponStyle => {
  const all = weaponStyles(race, cls);
  return all.find((s) => s.id === id) ?? all[0];
};
