/**
 * Torchlight-style action RPG rules: stats, gear with affixes and enhancement, monsters by level and the loot they drop. Pure data
 * and functions (no rendering), so they can be tested on their own (tests/torch-rules.test.mjs). Skills live in torchSkills.ts and
 * the world in torchWorld.ts.
 */
import { Camp, ZONES } from './torchWorld';
import { PassiveBonus } from './torchSkills';

export type Rarity = 'common' | 'magic' | 'rare' | 'epic' | 'legend';
export type Slot = 'weapon' | 'helm' | 'armor' | 'boots' | 'ring' | 'amulet';
export type Rand = () => number;

export const RARITIES: Record<Rarity, { name: string; color: string; mult: number; weight: number; affixes: number }> = {
  common: { name: 'Thường', color: '#d6d6d6', mult: 1, weight: 58, affixes: 0 },
  magic: { name: 'Phép', color: '#5fa8ff', mult: 1.35, weight: 28, affixes: 1 },
  rare: { name: 'Hiếm', color: '#ffd24a', mult: 1.8, weight: 10, affixes: 2 },
  epic: { name: 'Sử thi', color: '#c070ff', mult: 2.4, weight: 3.2, affixes: 3 },
  legend: { name: 'Huyền thoại', color: '#ff8a2a', mult: 3.2, weight: 0.8, affixes: 4 }
};
export const RARITY_ORDER: Rarity[] = ['common', 'magic', 'rare', 'epic', 'legend'];

export const SLOTS: Slot[] = ['weapon', 'helm', 'armor', 'boots', 'ring', 'amulet'];
export const SLOT_NAME: Record<Slot, string> = { weapon: 'Vũ khí', helm: 'Mũ', armor: 'Giáp', boots: 'Giày', ring: 'Nhẫn', amulet: 'Dây chuyền' };
export const SLOT_ICON: Record<Slot, string> = { weapon: '⚔️', helm: '⛑️', armor: '🥋', boots: '🥾', ring: '💍', amulet: '📿' };

/* ───────────────────────── affixes ───────────────────────── */

export type AffixStat = 'dmgPct' | 'critDmg' | 'lifeSteal' | 'speedPct' | 'cdr' | 'hpPct' | 'armorPct' | 'mpRegen' | 'goldFind' | 'xpPct';
export interface Affix {
  stat: AffixStat;
  value: number;
}

/** `base + per * level` is the typical roll; `pct` stats are fractions shown as percentages. */
export const AFFIXES: Record<AffixStat, { name: string; pct: boolean; base: number; per: number }> = {
  dmgPct: { name: 'Sát thương', pct: true, base: 0.03, per: 0.002 },
  critDmg: { name: 'Sát thương chí mạng', pct: true, base: 0.06, per: 0.004 },
  lifeSteal: { name: 'Hút máu', pct: true, base: 0.01, per: 0.0004 },
  speedPct: { name: 'Tốc độ chạy', pct: true, base: 0.03, per: 0.001 },
  cdr: { name: 'Giảm hồi chiêu', pct: true, base: 0.02, per: 0.001 },
  hpPct: { name: 'Máu tối đa', pct: true, base: 0.04, per: 0.003 },
  armorPct: { name: 'Giáp', pct: true, base: 0.05, per: 0.003 },
  mpRegen: { name: 'Hồi năng lượng/giây', pct: false, base: 0.5, per: 0.04 },
  goldFind: { name: 'Vàng rơi', pct: true, base: 0.06, per: 0.004 },
  xpPct: { name: 'Kinh nghiệm', pct: true, base: 0.04, per: 0.002 }
};

/** Which affixes each kind of gear can roll. */
const POOL: Record<Slot, AffixStat[]> = {
  weapon: ['dmgPct', 'critDmg', 'lifeSteal', 'cdr'],
  helm: ['cdr', 'hpPct', 'mpRegen', 'xpPct', 'armorPct'],
  armor: ['hpPct', 'armorPct', 'mpRegen', 'lifeSteal'],
  boots: ['speedPct', 'hpPct', 'goldFind', 'armorPct'],
  ring: ['dmgPct', 'critDmg', 'lifeSteal', 'goldFind', 'xpPct', 'mpRegen'],
  amulet: ['dmgPct', 'cdr', 'xpPct', 'goldFind', 'hpPct', 'critDmg']
};

export const formatAffix = (a: Affix) => {
  const def = AFFIXES[a.stat];
  return `+${def.pct ? `${(a.value * 100).toFixed(1)}%` : a.value.toFixed(1)} ${def.name}`;
};

/* ───────────────────────── items ───────────────────────── */

export interface Item {
  id: number;
  slot: Slot;
  rarity: Rarity;
  level: number;
  name: string;
  /** Base values before enhancement. */
  damage: number;
  armor: number;
  health: number;
  crit: number;
  affixes: Affix[];
  /** Enhancement level, 0 to ENHANCE_MAX. */
  enhance: number;
}
export type Gear = Partial<Record<Slot, Item>>;

export const BAG_SIZE = 28;
export const ENHANCE_MAX = 10;
const ENHANCE_STEP = 0.12;

const BASES: Record<Slot, string[]> = {
  weapon: ['Kiếm sắt', 'Rìu chiến', 'Đao cong', 'Trượng lửa', 'Búa chiến'],
  helm: ['Mũ da', 'Mũ sắt', 'Khôi đầu', 'Vương miện'],
  armor: ['Áo da', 'Giáp xích', 'Giáp tấm', 'Chiến bào'],
  boots: ['Giày vải', 'Ủng da', 'Ủng sắt'],
  ring: ['Nhẫn đồng', 'Nhẫn bạc', 'Nhẫn ngọc'],
  amulet: ['Bùa gỗ', 'Mặt dây bạc', 'Ngọc trụy']
};
const SUFFIX: Record<Rarity, string[]> = {
  common: [''],
  magic: [' của Gió', ' của Đá', ' của Sương'],
  rare: [' Rực Lửa', ' Hắc Ám', ' Bão Tố'],
  epic: [' Long Hồn', ' Thiên Lôi', ' Huyết Nguyệt'],
  legend: [' Thần Hỏa', ' Vĩnh Dạ', ' Diệt Thế']
};

/** Picks a rarity by weight; `bonus` shifts the odds towards better items (elites, bosses, magic find). */
export function rollRarity(rand: Rand, bonus = 0): Rarity {
  const w = RARITY_ORDER.map((r, i) => RARITIES[r].weight * (i === 0 ? 1 : 1 + bonus * i));
  let x = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    x -= w[i];
    if (x <= 0) return RARITY_ORDER[i];
  }
  return 'common';
}

let itemSeq = 0;
/** After loading a save, new items must not reuse an id. */
export const seedItemIds = (items: Item[]) => {
  for (const it of items) itemSeq = Math.max(itemSeq, it.id);
};

export function rollItem(rand: Rand, level: number, rarity: Rarity = rollRarity(rand), slot?: Slot): Item {
  slot ??= SLOTS[Math.floor(rand() * SLOTS.length)];
  const m = RARITIES[rarity].mult;
  const v = 0.85 + rand() * 0.3;
  const base = BASES[slot][Math.floor(rand() * BASES[slot].length)];
  const sfx = SUFFIX[rarity][Math.floor(rand() * SUFFIX[rarity].length)];
  const item: Item = { id: ++itemSeq, slot, rarity, level, name: base + sfx, damage: 0, armor: 0, health: 0, crit: 0, affixes: [], enhance: 0 };
  switch (slot) {
    case 'weapon':
      item.damage = Math.round((4 + level * 2.2) * m * v);
      item.crit = rarity === 'common' ? 0 : +(0.01 * m * v).toFixed(3);
      break;
    case 'armor':
      item.armor = Math.round((6 + level * 3) * m * v);
      item.health = Math.round(level * 4 * m * v);
      break;
    case 'helm':
      item.armor = Math.round((3 + level * 1.7) * m * v);
      item.health = Math.round(level * 3 * m * v);
      break;
    case 'boots':
      item.armor = Math.round((2 + level * 1.2) * m * v);
      item.health = Math.round(level * 2 * m * v);
      break;
    case 'ring':
      item.damage = Math.round((1 + level * 0.8) * m * v);
      item.crit = +(0.012 * m * v).toFixed(3);
      item.health = Math.round(level * 2 * m * v);
      break;
    case 'amulet':
      item.damage = Math.round((1 + level * 0.5) * m * v);
      item.health = Math.round(level * 3.5 * m * v);
      item.crit = +(0.008 * m * v).toFixed(3);
      break;
  }
  const pool = [...POOL[slot]];
  for (let i = 0; i < RARITIES[rarity].affixes && pool.length; i++) {
    const stat = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const def = AFFIXES[stat];
    const roll = (def.base + def.per * level) * (0.7 + rand() * 0.6) * (1 + RARITY_ORDER.indexOf(rarity) * 0.1);
    item.affixes.push({ stat, value: +roll.toFixed(def.pct ? 4 : 2) });
  }
  return item;
}

/** A base value after enhancement (+12% of the base per level). */
export const enhanced = (value: number, enhance: number) => value * (1 + ENHANCE_STEP * enhance);
export const itemStat = (i: Item, key: 'damage' | 'armor' | 'health' | 'crit') => {
  const v = enhanced(i[key], i.enhance);
  return key === 'crit' ? +v.toFixed(3) : Math.round(v);
};

/** One number to compare two items of the same slot. */
export const itemPower = (i: Item) =>
  itemStat(i, 'damage') * 3 + itemStat(i, 'armor') * 1.5 + itemStat(i, 'health') * 0.4 + itemStat(i, 'crit') * 400 + i.affixes.length * 6 * (1 + i.level * 0.15);
export const sellValue = (i: Item) => Math.max(1, Math.round(itemPower(i) * 0.6 * (1 + 0.15 * i.enhance)));

/** Name with the enhancement level, as shown in lists. */
export const itemTitle = (i: Item) => (i.enhance > 0 ? `${i.name} +${i.enhance}` : i.name);

/** Puts `item` on if it beats what is worn in that slot. Returns what was replaced (or the item itself if it was worse). */
export function equipIfBetter(gear: Gear, item: Item): { equipped: boolean; discarded: Item | null } {
  const cur = gear[item.slot];
  if (!cur || itemPower(item) > itemPower(cur)) {
    gear[item.slot] = item;
    return { equipped: true, discarded: cur ?? null };
  }
  return { equipped: false, discarded: item };
}

/* ───────────────────────── enhancing and salvaging ───────────────────────── */

export const ESSENCE_NAME = 'Tinh thạch';
const ENHANCE_CHANCE = [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
export const enhanceChance = (enhance: number) => ENHANCE_CHANCE[Math.min(enhance, ENHANCE_MAX - 1)] ?? 0;
export function enhanceCost(i: Item): { gold: number; essence: number } {
  const e = i.enhance;
  return { gold: Math.round(35 * Math.pow(1 + e, 1.7) * (1 + i.level * 0.08) * (1 + RARITY_ORDER.indexOf(i.rarity) * 0.3)), essence: 1 + e };
}

/** Try to raise the item one level. The cost is always paid; on failure the item stays as it is. */
export function tryEnhance(i: Item, wallet: { gold: number; essence: number }, rand: Rand): 'max' | 'poor' | 'success' | 'fail' {
  if (i.enhance >= ENHANCE_MAX) return 'max';
  const cost = enhanceCost(i);
  if (wallet.gold < cost.gold || wallet.essence < cost.essence) return 'poor';
  wallet.gold -= cost.gold;
  wallet.essence -= cost.essence;
  if (rand() < enhanceChance(i.enhance)) {
    i.enhance++;
    return 'success';
  }
  return 'fail';
}

/** Essence from breaking an item down; enhanced items return part of what they cost. */
export const salvageYield = (i: Item) => [1, 2, 4, 8, 16][RARITY_ORDER.indexOf(i.rarity)] * (1 + Math.floor(i.level / 8)) + Math.floor(i.enhance * 1.5);

/* ───────────────────────── player ───────────────────────── */

export interface Stats {
  maxHp: number;
  maxMp: number;
  damage: number;
  armor: number;
  crit: number;
  critDmg: number;
  speed: number;
  hpRegen: number;
  mpRegen: number;
  lifeSteal: number;
  cdr: number;
  goldFind: number;
  xpPct: number;
}

const NO_BONUS: PassiveBonus = { dmgPct: 0, hpPct: 0, crit: 0, mpRegen: 0, speedPct: 0, cdr: 0 };

export function affixTotals(gear: Gear): Record<AffixStat, number> {
  const t = Object.fromEntries(Object.keys(AFFIXES).map((k) => [k, 0])) as Record<AffixStat, number>;
  for (const it of Object.values(gear)) if (it) for (const a of it.affixes) t[a.stat] += a.value;
  return t;
}

export function playerStats(level: number, gear: Gear, passive: PassiveBonus = NO_BONUS): Stats {
  let damage = 9 + level * 2.4;
  let armor = 0;
  let health = 130 + level * 14;
  let crit = 0.06 + passive.crit;
  for (const it of Object.values(gear)) {
    if (!it) continue;
    damage += itemStat(it, 'damage');
    armor += itemStat(it, 'armor');
    health += itemStat(it, 'health');
    crit += itemStat(it, 'crit');
  }
  const a = affixTotals(gear);
  return {
    maxHp: health * (1 + a.hpPct + passive.hpPct),
    maxMp: 70 + level * 4,
    damage: damage * (1 + a.dmgPct + passive.dmgPct),
    armor: armor * (1 + a.armorPct),
    crit: Math.min(0.75, crit),
    critDmg: 1.75 + a.critDmg,
    speed: 5.4 * (1 + a.speedPct + passive.speedPct),
    hpRegen: 1 + level * 0.1,
    mpRegen: 3.5 + a.mpRegen + passive.mpRegen,
    lifeSteal: Math.min(0.25, a.lifeSteal),
    cdr: Math.min(0.5, a.cdr + passive.cdr),
    goldFind: a.goldFind,
    xpPct: a.xpPct
  };
}

export const MAX_LEVEL = 40;
export const xpToNext = (level: number) => Math.round(45 * Math.pow(level, 1.45));

/** Adds experience; returns how many levels were gained. */
export function gainXp(p: { level: number; xp: number }, amount: number): number {
  p.xp += amount;
  let gained = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    gained++;
  }
  if (p.level >= MAX_LEVEL) p.xp = Math.min(p.xp, xpToNext(p.level) - 1);
  return gained;
}

/** Damage after armour (diminishing returns, weaker against higher-level attackers). */
export const afterArmor = (raw: number, armor: number, attackerLevel: number) => raw * (1 - armor / (armor + 55 + attackerLevel * 12));

export function rollDamage(base: number, crit: number, rand: Rand, critDmg = 1.75): { amount: number; crit: boolean } {
  const isCrit = rand() < crit;
  const v = base * (0.9 + rand() * 0.2) * (isCrit ? critDmg : 1);
  return { amount: Math.max(1, Math.round(v)), crit: isCrit };
}

export const POTION = { hpHeal: 0.4, mpHeal: 0.5, cooldown: 8, start: 3, max: 9 };

/* ───────────────────────── monsters ───────────────────────── */

export type EnemyKind = 'grunt' | 'archer' | 'brute' | 'boss';
export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  scale: number;
  attackRange: number;
  attackCd: number;
  xp: number;
  gold: number;
  ranged: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: { kind: 'grunt', name: 'Yêu tinh', hp: 46, damage: 9, speed: 3.5, radius: 0.5, scale: 1, attackRange: 1.5, attackCd: 1.1, xp: 9, gold: 4, ranged: false },
  archer: { kind: 'archer', name: 'Cung thủ xương', hp: 32, damage: 10, speed: 2.9, radius: 0.5, scale: 1, attackRange: 13, attackCd: 2.1, xp: 12, gold: 6, ranged: true },
  brute: { kind: 'brute', name: 'Quỷ khổng lồ', hp: 190, damage: 24, speed: 2.5, radius: 0.9, scale: 1.55, attackRange: 2.4, attackCd: 1.9, xp: 34, gold: 18, ranged: false },
  boss: { kind: 'boss', name: 'Quỷ Vương Hắc Hỏa', hp: 800, damage: 34, speed: 3.1, radius: 1.3, scale: 2, attackRange: 3.4, attackCd: 1.7, xp: 260, gold: 150, ranged: false }
};

/** Monsters grow with their level: health faster than damage. */
export const monsterHp = (def: EnemyDef, level: number) => Math.round(def.hp * (1 + 0.3 * (level - 1) + 0.006 * (level - 1) * (level - 1)));
export const monsterDamage = (def: EnemyDef, level: number) => def.damage * (1 + 0.17 * (level - 1));
export const monsterXp = (def: EnemyDef, level: number) => def.xp * (1 + 0.16 * (level - 1));
/** A champion leads some camps: tougher, bigger, and always drops something good. */
export const CHAMPION = { hp: 2.6, damage: 1.3, scale: 1.25, xp: 3 };

export interface RosterEntry {
  kind: EnemyKind;
  champion: boolean;
}

/** Who stands in a camp: the zone decides the mix; a champion or the boss leads it. */
export function campRoster(camp: Camp, rand: Rand): RosterEntry[] {
  const zone = ZONES[camp.zone];
  const out: RosterEntry[] = [];
  if (camp.boss) out.push({ kind: 'boss', champion: false });
  else if (camp.champion) out.push({ kind: camp.zone === 'meadow' ? 'grunt' : 'brute', champion: true });
  const total = zone.mix.grunt + zone.mix.archer;
  while (out.length < camp.size + (camp.boss ? 1 : 0)) {
    let kind: EnemyKind = rand() * total < zone.mix.grunt ? 'grunt' : 'archer';
    if (kind === 'grunt' && camp.zone !== 'meadow' && rand() < 0.16) kind = 'brute';
    out.push({ kind, champion: false });
  }
  return out;
}

/** Drops of one dead monster. */
export interface Drops {
  gold: number;
  hpPotion: boolean;
  mpPotion: boolean;
  essence: number;
  items: Item[];
}
export function rollDrops(kind: EnemyKind, level: number, rand: Rand, opts: { champion?: boolean; goldFind?: number } = {}): Drops {
  const def = ENEMIES[kind];
  const boss = kind === 'boss';
  const elite = kind === 'brute' || !!opts.champion;
  const drops: Drops = {
    gold: Math.round(def.gold * (1 + level * 0.18) * (0.7 + rand() * 0.6) * (1 + (opts.goldFind ?? 0)) * (opts.champion ? 3 : 1)),
    hpPotion: rand() < (boss ? 1 : elite ? 0.3 : 0.07),
    mpPotion: rand() < (boss ? 1 : elite ? 0.25 : 0.06),
    essence: boss ? 3 + Math.floor(level / 4) : opts.champion ? 1 + Math.floor(rand() * 2) : kind === 'brute' && rand() < 0.3 ? 1 : 0,
    items: []
  };
  const chance = boss ? 1 : opts.champion ? 1 : kind === 'brute' ? 0.5 : kind === 'archer' ? 0.14 : 0.11;
  const bonus = boss ? 3 : opts.champion ? 1.8 : kind === 'brute' ? 1.2 : 0;
  if (rand() < chance) drops.items.push(rollItem(rand, level, rollRarity(rand, bonus)));
  if (boss) {
    drops.items.push(rollItem(rand, level, rollRarity(rand, 5)));
    drops.items.push(rollItem(rand, level, rollRarity(rand, 3)));
  }
  return drops;
}
