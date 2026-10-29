/**
 * Battle royale rules (PUBG-like): loot, ammo calibres, armour levels with durability, backpacks and carry weight,
 * healing and boost items, and the shrinking play zone. Pure logic, no three.js, so it can be unit-tested.
 */
import { HitGroup, WeaponId } from './rules';

export type AmmoType = '9mm' | '7.62' | '5.56' | '.300';
export type MedId = 'bandage' | 'firstaid' | 'medkit' | 'energy' | 'painkiller';
export type GearKind = 'vest' | 'helmet' | 'backpack';
export type Level = 1 | 2 | 3;

export const AMMO_OF: Partial<Record<WeaponId, AmmoType>> = { glock: '9mm', usp: '9mm', mp9: '9mm', deagle: '9mm', ak47: '7.62', m4a4: '5.56', awp: '.300' };
export const AMMO_NAME: Record<AmmoType, string> = { '9mm': 'Đạn 9mm', '7.62': 'Đạn 7.62mm', '5.56': 'Đạn 5.56mm', '.300': 'Đạn .300 Magnum' };
const AMMO_WEIGHT: Record<AmmoType, number> = { '9mm': 0.375, '7.62': 0.7, '5.56': 0.5, '.300': 1 };

export interface MedDef {
  name: string;
  /** Seconds to use. */
  use: number;
  /** Health restored, never above `cap`. */
  heal: number;
  cap: number;
  boost: number;
  weight: number;
}
export const MEDS: Record<MedId, MedDef> = {
  bandage: { name: 'Băng gạc', use: 4, heal: 10, cap: 75, boost: 0, weight: 2 },
  firstaid: { name: 'Bộ sơ cứu', use: 6, heal: 75, cap: 75, boost: 0, weight: 10 },
  medkit: { name: 'Hộp y tế', use: 8, heal: 100, cap: 100, boost: 0, weight: 20 },
  energy: { name: 'Nước tăng lực', use: 4, heal: 0, cap: 100, boost: 40, weight: 4 },
  painkiller: { name: 'Thuốc giảm đau', use: 6, heal: 0, cap: 100, boost: 60, weight: 10 }
};

/** Damage reduction and durability per armour level (PUBG values). */
export const GEAR = {
  vest: { reduce: [0, 0.3, 0.4, 0.55], durability: [0, 200, 220, 250], name: ['', 'Áo giáp cấp 1', 'Áo giáp cấp 2', 'Áo giáp cấp 3'] },
  helmet: { reduce: [0, 0.3, 0.4, 0.55], durability: [0, 80, 150, 230], name: ['', 'Mũ cấp 1', 'Mũ cấp 2', 'Mũ cấp 3'] },
  backpack: { capacity: [0, 150, 200, 250], name: ['', 'Balo cấp 1', 'Balo cấp 2', 'Balo cấp 3'] }
} as const;
/** Carry capacity without a backpack (pockets). */
export const BASE_CAPACITY = 80;
const GRENADE_WEIGHT = 18;

export type Loot =
  | { kind: 'weapon'; id: WeaponId }
  | { kind: 'ammo'; ammo: AmmoType; count: number }
  | { kind: 'gear'; gear: GearKind; level: Level; durability: number }
  | { kind: 'med'; med: MedId; count: number }
  | { kind: 'grenade'; id: 'he' | 'flash' | 'smoke' };

export interface Armour {
  level: Level;
  durability: number;
}

export interface BRInventory {
  ammo: Record<AmmoType, number>;
  meds: Record<MedId, number>;
  vest: Armour | null;
  helmet: Armour | null;
  backpack: 0 | Level;
}

export const newBRInventory = (): BRInventory => ({
  ammo: { '9mm': 0, '7.62': 0, '5.56': 0, '.300': 0 },
  meds: { bandage: 0, firstaid: 0, medkit: 0, energy: 0, painkiller: 0 },
  vest: null,
  helmet: null,
  backpack: 0
});

export const capacity = (b: BRInventory) => BASE_CAPACITY + (b.backpack ? GEAR.backpack.capacity[b.backpack] : 0);

export function weight(b: BRInventory, grenades = 0) {
  let w = grenades * GRENADE_WEIGHT;
  for (const [t, n] of Object.entries(b.ammo)) w += AMMO_WEIGHT[t as AmmoType] * n;
  for (const [m, n] of Object.entries(b.meds)) w += MEDS[m as MedId].weight * n;
  return w;
}

/** How many of a loot item fit in the bag (weapons and worn gear weigh nothing here). */
export function roomFor(b: BRInventory, loot: Loot, grenades = 0): number {
  const free = capacity(b) - weight(b, grenades);
  if (loot.kind === 'ammo') return Math.max(0, Math.min(loot.count, Math.floor(free / AMMO_WEIGHT[loot.ammo] + 1e-9)));
  if (loot.kind === 'med') return Math.max(0, Math.min(loot.count, Math.floor(free / MEDS[loot.med].weight + 1e-9)));
  if (loot.kind === 'grenade') return free >= GRENADE_WEIGHT ? 1 : 0;
  return 1;
}

/** Whether a gear piece beats what is worn (higher level, or the same level with clearly more durability). */
export function isUpgrade(b: BRInventory, loot: Loot) {
  if (loot.kind !== 'gear') return false;
  if (loot.gear === 'backpack') return loot.level > b.backpack;
  const cur = b[loot.gear];
  return !cur || loot.level > cur.level || (loot.level === cur.level && loot.durability > cur.durability + 20);
}

export const lootName = (l: Loot, weaponName: (id: WeaponId) => string): string => {
  switch (l.kind) {
    case 'weapon':
    case 'grenade':
      return weaponName(l.id);
    case 'ammo':
      return `${AMMO_NAME[l.ammo]} ×${l.count}`;
    case 'med':
      return l.count > 1 ? `${MEDS[l.med].name} ×${l.count}` : MEDS[l.med].name;
    case 'gear':
      return l.gear === 'backpack' ? GEAR.backpack.name[l.level] : `${GEAR[l.gear].name[l.level]} (${Math.round(l.durability)})`;
  }
};

/* ───────────── damage ───────────── */

/** PUBG hit-group multipliers (headshots hurt less than in CS, legs a little less than the body). */
export const BR_HIT_MULT: Record<HitGroup, number> = { head: 2.35, chest: 1, stomach: 1, legs: 0.9 };

/**
 * Health damage after the hit group and the armour on it. Armour loses durability by the raw damage and breaks at 0.
 * `damage` already includes range falloff.
 */
export function brDamage(damage: number, group: HitGroup, b: BRInventory) {
  const raw = damage * BR_HIT_MULT[group];
  const piece = group === 'head' ? 'helmet' : group === 'legs' ? null : 'vest';
  const armour = piece ? b[piece] : null;
  if (!piece || !armour) return { health: raw, broke: false };
  const health = raw * (1 - GEAR[piece].reduce[armour.level]);
  armour.durability -= raw;
  const broke = armour.durability <= 0;
  if (broke) b[piece] = null;
  return { health, broke };
}

/* ───────────── healing & boost ───────────── */

/** Health a med restores when used at `health`. */
export const healAmount = (med: MedId, health: number) => {
  const d = MEDS[med];
  if (!d.heal) return 0;
  if (med === 'firstaid') return Math.max(0, d.cap - health);
  return Math.max(0, Math.min(d.heal, d.cap - health));
};

/** The med worth using now, or null: medkit when very low, first aid under 60, bandages to top up to 75. */
export function bestHeal(b: BRInventory, health: number): MedId | null {
  if (health < 45 && b.meds.medkit) return 'medkit';
  if (health >= 75) return null;
  if (health < 60 && b.meds.firstaid) return 'firstaid';
  if (b.meds.bandage) return 'bandage';
  if (b.meds.firstaid) return 'firstaid';
  if (b.meds.medkit) return 'medkit';
  return null;
}
export const bestBoost = (b: BRInventory, boost: number): MedId | null =>
  boost < 40 && b.meds.painkiller ? 'painkiller' : boost < 60 && b.meds.energy ? 'energy' : null;

/** Boost drains over time; while it lasts it heals (more when higher) and above 60 makes you faster. */
export function boostEffect(boost: number) {
  if (boost <= 0) return { healPerSec: 0, speed: 1 };
  const healPerSec = boost > 90 ? 4 / 8 : boost > 60 ? 3 / 8 : boost > 20 ? 2 / 8 : 1 / 8;
  const speed = boost > 90 ? 1.062 : boost > 60 ? 1.025 : 1;
  return { healPerSec, speed };
}
/** Boost points lost per second. */
export const BOOST_DRAIN = 0.4;

/* ───────────── zone ───────────── */

export interface Circle {
  x: number;
  z: number;
  r: number;
}
export interface ZonePhase {
  wait: number;
  shrink: number;
  /** Radius of the circle this phase shrinks to. */
  radius: number;
  /** Damage per second outside the zone while this phase shrinks (and during the next wait). */
  dps: number;
}
export const ZONE_PHASES: ZonePhase[] = [
  { wait: 90, shrink: 60, radius: 112, dps: 1 },
  { wait: 68, shrink: 45, radius: 68, dps: 2 },
  { wait: 53, shrink: 38, radius: 36, dps: 4 },
  { wait: 38, shrink: 30, radius: 17, dps: 7 },
  { wait: 30, shrink: 30, radius: 0, dps: 12 }
];
export const ZONE_START: Circle = { x: 0, z: 0, r: 495 };

/** Circles of every phase: each lies fully inside the previous one and its centre stays on the map. */
export function planZones(rand: () => number, limit: number, phases = ZONE_PHASES): Circle[] {
  const out: Circle[] = [ZONE_START];
  for (const ph of phases) {
    const cur = out[out.length - 1];
    let next: Circle = { x: cur.x, z: cur.z, r: ph.radius };
    for (let i = 0; i < 60; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * Math.max(0, Math.min(cur.r, limit) - ph.radius);
      const c = { x: cur.x + Math.cos(a) * d, z: cur.z + Math.sin(a) * d, r: ph.radius };
      const inMap = Math.abs(c.x) + ph.radius * 0.5 < limit && Math.abs(c.z) + ph.radius * 0.5 < limit;
      if (inMap && Math.hypot(c.x - cur.x, c.z - cur.z) + c.r <= cur.r + 1e-6) {
        next = c;
        break;
      }
    }
    out.push(next);
  }
  return out;
}

export interface ZoneNow {
  cur: Circle;
  next: Circle | null;
  phase: number;
  shrinking: boolean;
  /** Seconds until the wait ends (or the shrink ends). */
  timeLeft: number;
  dps: number;
}

/** The zone at time `t` since the match started. */
export function zoneAt(circles: Circle[], t: number, phases = ZONE_PHASES): ZoneNow {
  let start = 0;
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i];
    const a = circles[i];
    const b = circles[i + 1];
    if (t < start + ph.wait) return { cur: a, next: b, phase: i, shrinking: false, timeLeft: start + ph.wait - t, dps: i === 0 ? 0.5 : phases[i - 1].dps };
    if (t < start + ph.wait + ph.shrink) {
      const k = (t - start - ph.wait) / ph.shrink;
      return { cur: { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, r: a.r + (b.r - a.r) * k }, next: b, phase: i, shrinking: true, timeLeft: start + ph.wait + ph.shrink - t, dps: ph.dps };
    }
    start += ph.wait + ph.shrink;
  }
  return { cur: circles[circles.length - 1], next: null, phase: phases.length, shrinking: false, timeLeft: 0, dps: phases[phases.length - 1].dps };
}

/* ───────────── loot tables ───────────── */

type Entry = [number, () => Loot[]];
const weaponWithAmmo = (id: WeaponId, rand: () => number): Loot[] => {
  const ammo = AMMO_OF[id];
  const out: Loot[] = [{ kind: 'weapon', id }];
  if (ammo) out.push({ kind: 'ammo', ammo, count: ammo === '.300' ? 10 : 20 + Math.floor(rand() * 3) * 10 });
  return out;
};
const gear = (g: GearKind, level: Level): Loot => ({ kind: 'gear', gear: g, level, durability: g === 'backpack' ? 0 : GEAR[g].durability[level] });

/** 1–3 items for a loot spot; buildings have better odds of rifles. */
export function rollLoot(rand: () => number, indoor: boolean): Loot[] {
  const table: Entry[] = [
    [10, () => weaponWithAmmo('glock', rand)],
    [8, () => weaponWithAmmo('usp', rand)],
    [5, () => weaponWithAmmo('deagle', rand)],
    [9, () => weaponWithAmmo('mp9', rand)],
    [indoor ? 7 : 4, () => weaponWithAmmo('ak47', rand)],
    [indoor ? 7 : 4, () => weaponWithAmmo('m4a4', rand)],
    [indoor ? 1.5 : 0.6, () => weaponWithAmmo('awp', rand)],
    [14, () => [{ kind: 'ammo', ammo: (['9mm', '7.62', '5.56', '.300'] as AmmoType[])[Math.min(3, Math.floor(rand() * 3.4))], count: 30 }]],
    [8, () => [gear('vest', 1)]],
    [4, () => [gear('vest', 2)]],
    [1, () => [gear('vest', 3)]],
    [8, () => [gear('helmet', 1)]],
    [4, () => [gear('helmet', 2)]],
    [1, () => [gear('helmet', 3)]],
    [6, () => [gear('backpack', 1)]],
    [3, () => [gear('backpack', 2)]],
    [1, () => [gear('backpack', 3)]],
    [12, () => [{ kind: 'med', med: 'bandage', count: 5 }]],
    [5, () => [{ kind: 'med', med: 'firstaid', count: 1 }]],
    [1.2, () => [{ kind: 'med', med: 'medkit', count: 1 }]],
    [5, () => [{ kind: 'med', med: 'energy', count: 1 }]],
    [3, () => [{ kind: 'med', med: 'painkiller', count: 1 }]],
    [3, () => [{ kind: 'grenade', id: 'he' }]],
    [2, () => [{ kind: 'grenade', id: 'flash' }]],
    [3, () => [{ kind: 'grenade', id: 'smoke' }]]
  ];
  const total = table.reduce((s, [w]) => s + w, 0);
  const pick = () => {
    let r = rand() * total;
    for (const [w, f] of table) if ((r -= w) <= 0) return f();
    return table[0][1]();
  };
  const n = 1 + (rand() < (indoor ? 0.5 : 0.25) ? 1 : 0) + (rand() < (indoor ? 0.15 : 0.05) ? 1 : 0);
  const out: Loot[] = [];
  for (let i = 0; i < n; i++) out.push(...pick());
  return out;
}
