/**
 * Pure gameplay rules modelled on Counter-Strike: weapon stats, spray patterns, inaccuracy, damage / armour, the inventory and
 * collision. Distances are metres, angles radians unless a name says otherwise. No three.js here so it can be unit-tested.
 */

export type Team = 'CT' | 'T';
export type WeaponId =
  | 'knife' | 'glock' | 'usp' | 'deagle' | 'mp9' | 'ak47' | 'm4a4' | 'awp' | 'he' | 'flash' | 'smoke'
  // battle royale only: found as loot, not sold in the 5v5 shop
  | 'ump' | 'scar' | 'm249' | 'sks' | 'kar98' | 's12k';
export type SlotNo = 1 | 2 | 3 | 4;
export type HitGroup = 'head' | 'chest' | 'stomach' | 'legs';
export type Pattern = readonly (readonly [number, number])[];

export interface WeaponDef {
  id: WeaponId;
  name: string;
  slot: SlotNo;
  damage: number;
  /** Fraction of damage that goes through kevlar. */
  armorPen: number;
  /** Damage multiplier per 12.7 m (500 Source units). */
  falloff: number;
  /** Seconds between shots. */
  cycle: number;
  auto: boolean;
  magazine: number;
  reserve: number;
  reload: number;
  deploy: number;
  /** Inaccuracy cone half-angles (rad). */
  standInacc: number;
  moveInacc: number;
  airInacc: number;
  /** Added per shot, decays with `recovery` seconds. */
  fireInacc: number;
  recovery: number;
  /** Recoil pattern (deg, cumulative [yaw right, pitch up]) indexed by shots in the spray. */
  pattern: Pattern;
  /** Spray index recovered per second when not firing. */
  recoilDecay: number;
  /** Max movement speed as a fraction of the base run speed. */
  speed: number;
  /** Thickest wall (m) the bullet can go through. */
  penetration: number;
  range: number;
  /** Vertical field of view (deg) for each scope level. */
  scope?: readonly number[];
  /** Bullets per shot (shotguns); each pellet deals `damage`. */
  pellets?: number;
}

/* ───────────── spray patterns ───────────── */

// AK-47 spray: straight climb for ~9 shots, then left, right, left. An approximation of the in-game pattern.
const AK_PATTERN: Pattern = [
  [0, 0], [0, 0.35], [0.05, 1.05], [-0.05, 1.95], [0.05, 2.95], [0.2, 3.95], [0.35, 4.8], [0.15, 5.5], [-0.25, 6.05], [-0.65, 6.45],
  [-1.35, 6.7], [-2.15, 6.9], [-2.7, 7.0], [-2.55, 7.1], [-1.55, 7.2], [-0.1, 7.25], [1.25, 7.3], [2.3, 7.35], [2.9, 7.45], [2.6, 7.5],
  [1.7, 7.55], [0.65, 7.6], [-0.5, 7.65], [-1.45, 7.7], [-2.15, 7.75], [-2.45, 7.8], [-2.1, 7.85], [-1.2, 7.9], [-0.1, 7.95], [0.7, 8.0]
];
const scaled = (p: Pattern, sx: number, sy: number, mirror = false): Pattern => p.map(([x, y]) => [(mirror ? -x : x) * sx, y * sy] as const);
const linear = (n: number, kick: number, wobble: number): Pattern =>
  Array.from({ length: n }, (_, i) => [Math.sin(i * 1.7) * wobble * Math.min(1, i / 3), i * kick] as const);

/** Pattern value at a fractional spray index (linear interpolation, clamped to the last entry). */
export function patternAt(p: Pattern, index: number): [number, number] {
  if (index <= 0) return [0, 0];
  const i = Math.min(p.length - 1, Math.floor(index));
  const j = Math.min(p.length - 1, i + 1);
  const t = Math.min(1, index - i);
  return [p[i][0] + (p[j][0] - p[i][0]) * t, p[i][1] + (p[j][1] - p[i][1]) * t];
}

/* ───────────── weapons ───────────── */

const noGun = { armorPen: 1, falloff: 1, auto: false, magazine: 1, reserve: 0, reload: 0, deploy: 0.5, standInacc: 0, moveInacc: 0, airInacc: 0, fireInacc: 0,
  recovery: 1, pattern: [[0, 0]] as Pattern, recoilDecay: 1, speed: 1, penetration: 0, range: 0, cycle: 1 };

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  knife: { id: 'knife', name: 'Dao', slot: 3, damage: 40, armorPen: 0.85, falloff: 1, cycle: 0.4, auto: true, magazine: 0, reserve: 0, reload: 0, deploy: 0.45,
    standInacc: 0, moveInacc: 0, airInacc: 0, fireInacc: 0, recovery: 0.1, pattern: [[0, 0]], recoilDecay: 10, speed: 1, penetration: 0, range: 1.8 },
  glock: { id: 'glock', name: 'Glock-18', slot: 2, damage: 30, armorPen: 0.47, falloff: 0.85, cycle: 0.15, auto: false, magazine: 20, reserve: 120, reload: 2.2, deploy: 0.5,
    standInacc: 0.0055, moveInacc: 0.03, airInacc: 0.25, fireInacc: 0.012, recovery: 0.3, pattern: linear(20, 0.9, 0.3), recoilDecay: 9, speed: 0.96, penetration: 0.12, range: 80 },
  usp: { id: 'usp', name: 'USP-S', slot: 2, damage: 35, armorPen: 0.505, falloff: 0.91, cycle: 0.17, auto: false, magazine: 12, reserve: 24, reload: 2.2, deploy: 0.5,
    standInacc: 0.0035, moveInacc: 0.03, airInacc: 0.25, fireInacc: 0.016, recovery: 0.32, pattern: linear(12, 1.1, 0.25), recoilDecay: 8, speed: 0.96, penetration: 0.14, range: 90 },
  deagle: { id: 'deagle', name: 'Desert Eagle', slot: 2, damage: 63, armorPen: 0.932, falloff: 0.81, cycle: 0.225, auto: false, magazine: 7, reserve: 35, reload: 2.2, deploy: 0.6,
    standInacc: 0.0065, moveInacc: 0.09, airInacc: 0.35, fireInacc: 0.055, recovery: 0.5, pattern: linear(7, 2.6, 0.5), recoilDecay: 4.5, speed: 0.92, penetration: 0.35, range: 110 },
  mp9: { id: 'mp9', name: 'MP9', slot: 1, damage: 26, armorPen: 0.6, falloff: 0.87, cycle: 0.07, auto: true, magazine: 30, reserve: 120, reload: 2.1, deploy: 0.55,
    standInacc: 0.009, moveInacc: 0.028, airInacc: 0.3, fireInacc: 0.0045, recovery: 0.25, pattern: scaled(AK_PATTERN, 0.55, 0.5), recoilDecay: 13, speed: 0.96, penetration: 0.18, range: 90 },
  ak47: { id: 'ak47', name: 'AK-47', slot: 1, damage: 36, armorPen: 0.775, falloff: 0.98, cycle: 0.1, auto: true, magazine: 30, reserve: 90, reload: 2.45, deploy: 0.75,
    standInacc: 0.0048, moveInacc: 0.14, airInacc: 0.4, fireInacc: 0.0075, recovery: 0.38, pattern: AK_PATTERN, recoilDecay: 10, speed: 0.86, penetration: 0.45, range: 200 },
  m4a4: { id: 'm4a4', name: 'M4A4', slot: 1, damage: 33, armorPen: 0.7, falloff: 0.97, cycle: 0.09, auto: true, magazine: 30, reserve: 90, reload: 3.1, deploy: 0.75,
    standInacc: 0.0039, moveInacc: 0.12, airInacc: 0.4, fireInacc: 0.006, recovery: 0.33, pattern: scaled(AK_PATTERN, 0.7, 0.78, true), recoilDecay: 11, speed: 0.9, penetration: 0.42, range: 200 },
  awp: { id: 'awp', name: 'AWP', slot: 1, damage: 115, armorPen: 0.975, falloff: 0.99, cycle: 1.46, auto: false, magazine: 10, reserve: 30, reload: 3.7, deploy: 1.1,
    standInacc: 0.075, moveInacc: 0.22, airInacc: 0.5, fireInacc: 0.09, recovery: 0.6, pattern: linear(10, 3.5, 0), recoilDecay: 2, speed: 0.8, penetration: 0.9, range: 220, scope: [40, 10] },
  ump: { id: 'ump', name: 'UMP9', slot: 1, damage: 30, armorPen: 0.65, falloff: 0.85, cycle: 0.092, auto: true, magazine: 25, reserve: 100, reload: 2.6, deploy: 0.6,
    standInacc: 0.008, moveInacc: 0.03, airInacc: 0.3, fireInacc: 0.005, recovery: 0.26, pattern: scaled(AK_PATTERN, 0.5, 0.45), recoilDecay: 12, speed: 0.95, penetration: 0.2, range: 100 },
  scar: { id: 'scar', name: 'SCAR-L', slot: 1, damage: 33, armorPen: 0.72, falloff: 0.97, cycle: 0.096, auto: true, magazine: 30, reserve: 90, reload: 2.7, deploy: 0.75,
    standInacc: 0.0042, moveInacc: 0.12, airInacc: 0.4, fireInacc: 0.0062, recovery: 0.34, pattern: scaled(AK_PATTERN, 0.62, 0.7), recoilDecay: 11, speed: 0.88, penetration: 0.42, range: 200 },
  m249: { id: 'm249', name: 'M249', slot: 1, damage: 31, armorPen: 0.75, falloff: 0.96, cycle: 0.075, auto: true, magazine: 100, reserve: 200, reload: 5.5, deploy: 1.2,
    standInacc: 0.007, moveInacc: 0.2, airInacc: 0.5, fireInacc: 0.007, recovery: 0.45, pattern: scaled(AK_PATTERN, 0.8, 0.6), recoilDecay: 8, speed: 0.78, penetration: 0.5, range: 200 },
  sks: { id: 'sks', name: 'SKS', slot: 1, damage: 55, armorPen: 0.85, falloff: 0.98, cycle: 0.25, auto: false, magazine: 10, reserve: 40, reload: 2.9, deploy: 0.9,
    standInacc: 0.004, moveInacc: 0.15, airInacc: 0.45, fireInacc: 0.03, recovery: 0.4, pattern: linear(10, 2.2, 0.3), recoilDecay: 5, speed: 0.86, penetration: 0.55, range: 220, scope: [40] },
  kar98: { id: 'kar98', name: 'Kar98k', slot: 1, damage: 100, armorPen: 0.95, falloff: 0.99, cycle: 1.9, auto: false, magazine: 5, reserve: 20, reload: 4, deploy: 1,
    standInacc: 0.06, moveInacc: 0.2, airInacc: 0.5, fireInacc: 0.08, recovery: 0.6, pattern: linear(5, 3.2, 0), recoilDecay: 2, speed: 0.84, penetration: 0.8, range: 220, scope: [40, 10] },
  s12k: { id: 's12k', name: 'S12K', slot: 1, damage: 22, pellets: 9, armorPen: 0.6, falloff: 0.55, cycle: 0.25, auto: false, magazine: 5, reserve: 25, reload: 3, deploy: 0.8,
    standInacc: 0.045, moveInacc: 0.06, airInacc: 0.3, fireInacc: 0.02, recovery: 0.4, pattern: linear(5, 2.5, 0.4), recoilDecay: 4, speed: 0.9, penetration: 0.1, range: 40 },
  he: { ...noGun, id: 'he', name: 'Lựu đạn nổ', slot: 4, damage: 98, armorPen: 0.57 },
  flash: { ...noGun, id: 'flash', name: 'Lựu đạn choáng', slot: 4, damage: 0 },
  smoke: { ...noGun, id: 'smoke', name: 'Lựu đạn khói', slot: 4, damage: 0 }
};
export const GRENADE_LIMIT: Partial<Record<WeaponId, number>> = { he: 1, flash: 2, smoke: 1 };
export const isGrenade = (id: WeaponId) => WEAPONS[id].slot === 4;
export const defaultPistol = (team: Team): WeaponId => (team === 'T' ? 'glock' : 'usp');

/* ───────────── movement ───────────── */

export const MOVE = {
  run: 5.6,
  walkFactor: 0.52,
  crouchFactor: 0.34,
  /** Under this fraction of max speed a weapon is as accurate as standing still. */
  accurateFraction: 0.34,
  accel: 48,
  friction: 34,
  airAccel: 8,
  jump: 5.4,
  gravity: 12.5,
  stepHeight: 0.38,
  eyeStand: 1.62,
  eyeCrouch: 1.18,
  eyeProne: 0.42,
  proneFactor: 0.2,
  sprintFactor: 1.3,
  /** Prone or crouched spread is multiplied by these (lying on the ground steadies the gun most). */
  crouchSpread: 0.75,
  proneSpread: 0.55,
  radius: 0.36
} as const;

/** How the body moves on top of walking / crouching: lying down and crawling, or sprinting (PUBG style). */
export type Gait = 'normal' | 'prone' | 'sprint';

/** Max ground speed for a weapon and stance. */
export const maxSpeed = (id: WeaponId, walking: boolean, crouched: boolean, scoped = false, gait: Gait = 'normal') => {
  const base = MOVE.run * WEAPONS[id].speed * (scoped ? 0.75 : 1);
  if (gait === 'prone') return base * MOVE.proneFactor;
  if (crouched) return base * MOVE.crouchFactor;
  if (gait === 'sprint') return base * MOVE.sprintFactor;
  return walking ? base * MOVE.walkFactor : base;
};

/* ───────────── weapon state ───────────── */

export interface WeaponState {
  id: WeaponId;
  ammo: number;
  reserve: number;
  reloadLeft: number;
  cooldown: number;
  deployLeft: number;
  /** Shots in the current spray (fractional while recovering). */
  recoil: number;
  /** Accumulated first-shot penalty. */
  fireInacc: number;
  /** Scope level, 0 = unscoped. */
  zoom: number;
  /** Seconds since the last shot. */
  idle: number;
}

export const newWeapon = (id: WeaponId): WeaponState => ({
  id, ammo: WEAPONS[id].magazine, reserve: WEAPONS[id].reserve, reloadLeft: 0, cooldown: 0, deployLeft: WEAPONS[id].deploy, recoil: 0, fireInacc: 0, zoom: 0, idle: 99
});

export function beginReload(w: WeaponState): boolean {
  const def = WEAPONS[w.id];
  if (def.slot > 2 || w.reloadLeft > 0 || w.deployLeft > 0 || w.ammo >= def.magazine || w.reserve <= 0) return false;
  w.reloadLeft = def.reload;
  w.zoom = 0;
  return true;
}

export function tickWeapon(w: WeaponState, dt: number) {
  const def = WEAPONS[w.id];
  w.cooldown = Math.max(0, w.cooldown - dt);
  w.deployLeft = Math.max(0, w.deployLeft - dt);
  // the spray only recovers once the trigger has been let go for longer than one shot cycle
  w.idle += dt;
  if (w.idle > def.cycle + 0.06) w.recoil = Math.max(0, w.recoil - dt * def.recoilDecay);
  w.fireInacc *= Math.exp(-dt / def.recovery);
  if (w.reloadLeft <= 0) return;
  w.reloadLeft = Math.max(0, w.reloadLeft - dt);
  if (w.reloadLeft === 0) {
    const count = Math.min(def.magazine - w.ammo, w.reserve);
    w.ammo += count;
    w.reserve -= count;
  }
}

export const canFire = (w: WeaponState) => w.cooldown <= 0 && w.deployLeft <= 0 && w.reloadLeft <= 0 && (w.id === 'knife' || w.ammo > 0);

/** Spend one shot. Returns the spray index the bullet should use, or -1 when the weapon cannot fire. */
export function consumeShot(w: WeaponState): number {
  if (!canFire(w)) return -1;
  const def = WEAPONS[w.id];
  const index = w.recoil;
  if (w.id !== 'knife') w.ammo--;
  w.cooldown = def.cycle;
  w.recoil = Math.min(def.pattern.length - 1, w.recoil + 1);
  w.idle = 0;
  w.fireInacc = Math.min(0.2, w.fireInacc + def.fireInacc);
  return index;
}

export interface Stance {
  /** Horizontal speed (m/s). */
  speed: number;
  crouched: boolean;
  airborne: boolean;
  prone?: boolean;
}

/** Current inaccuracy cone half-angle (rad) for a weapon in a stance. */
export function inaccuracy(w: WeaponState, s: Stance): number {
  const def = WEAPONS[w.id];
  const max = MOVE.run * def.speed;
  const moving = Math.max(0, Math.min(1, (s.speed / max - MOVE.accurateFraction) / (1 - MOVE.accurateFraction)));
  let stand = def.standInacc * (s.prone ? MOVE.proneSpread : s.crouched ? MOVE.crouchSpread : 1);
  if (def.scope && w.zoom > 0) stand = 0.0012;
  return stand + def.moveInacc * moving + (s.airborne ? def.airInacc : 0) + w.fireInacc;
}

/** Aim punch (rad, [yaw right, pitch up]) at a spray index, times `scale` (see recoilScale). Bullets and the view both follow it. */
export function aimPunch(id: WeaponId, index: number, scale = 1): [number, number] {
  const [x, y] = patternAt(WEAPONS[id].pattern, index);
  return [(x * Math.PI * scale) / 180, (y * Math.PI * scale) / 180];
}

/** Recoil multipliers (PUBG): crouching and lying down steady the gun, and so does shouldering it down the sights. */
export const RECOIL_SCALE = { stand: 1, crouch: 0.8, prone: 0.6, ads: 0.85 } as const;

/** How much of the spray pattern a shooter feels in a stance; `crouch` and `prone` are the 0..1 blends of the body. */
export function recoilScale(s: { crouch: number; prone: number; ads: boolean }): number {
  const body = s.prone > 0.5 ? RECOIL_SCALE.prone : s.crouch > 0.5 ? RECOIL_SCALE.crouch : RECOIL_SCALE.stand;
  return body * (s.ads ? RECOIL_SCALE.ads : 1);
}

/* ───────────── damage ───────────── */

export const HIT_MULT: Record<HitGroup, number> = { head: 4, chest: 1, stomach: 1.25, legs: 0.75 };

/** Damage after falloff, hit group and armour. `damage` is the (possibly penetration-reduced) base damage. */
export function computeDamage(id: WeaponId, damage: number, distance: number, group: HitGroup, armor: number, helmet: boolean) {
  const def = WEAPONS[id];
  let dmg = damage * Math.pow(def.falloff, distance / 12.7) * HIT_MULT[group];
  let armorDmg = 0;
  const armored = armor > 0 && (group === 'head' ? helmet : group !== 'legs');
  if (armored) {
    const health = dmg * def.armorPen;
    armorDmg = (dmg - health) * 0.5;
    if (armorDmg > armor) {
      dmg = health + (armorDmg - armor) * 2;
      armorDmg = armor;
    } else dmg = health;
  }
  return { health: Math.max(1, Math.floor(dmg)), armor: Math.floor(armorDmg) };
}

/** Damage left after a bullet crossed `thickness` metres of wall, or 0 when it cannot get through. */
export function penetrate(id: WeaponId, damage: number, thickness: number): number {
  const max = WEAPONS[id].penetration;
  if (thickness >= max) return 0;
  return damage * (1 - thickness / max) * 0.75;
}

/** HE damage at a distance before armour (no line-of-sight check). */
export const heDamage = (distance: number) => (distance >= 7.5 ? 0 : WEAPONS.he.damage * Math.pow(1 - distance / 7.5, 1.4));

/** Seconds of blindness from a flash. `facing` is the cosine between view direction and the direction to the flash. */
export function flashDuration(distance: number, facing: number): number {
  if (distance > 32) return 0;
  const angle = facing > 0.55 ? 1 : facing > 0 ? 0.55 : 0.18;
  return 4.2 * angle * Math.max(0.25, 1 - distance / 32);
}

/* ───────────── inventory ───────────── */

export interface Inventory {
  primary: WeaponState | null;
  secondary: WeaponState | null;
  knife: WeaponState;
  /** Grenades carried, in pick order. */
  grenades: WeaponId[];
  /** The grenade in hand while slot 4 is active. */
  grenade: WeaponState | null;
  active: SlotNo;
  last: SlotNo;
  armor: number;
  helmet: boolean;
}

export const newInventory = (team: Team): Inventory => ({
  primary: null, secondary: newWeapon(defaultPistol(team)), knife: newWeapon('knife'), grenades: [], grenade: null, active: 2, last: 3, armor: 0, helmet: false
});

export function weaponInSlot(inv: Inventory, slot: SlotNo): WeaponState | null {
  if (slot === 1) return inv.primary;
  if (slot === 2) return inv.secondary;
  if (slot === 4) return inv.grenade;
  return inv.knife;
}
export const activeWeapon = (inv: Inventory) => weaponInSlot(inv, inv.active);

/**
 * Switch to a slot. Pressing 4 again cycles through the carried grenades. Returns false when the slot is empty.
 * A drawn weapon has to be deployed again before it can fire.
 */
export function selectSlot(inv: Inventory, slot: SlotNo): boolean {
  if (slot === 4) {
    if (!inv.grenades.length) return false;
    const kinds = [...new Set(inv.grenades)];
    const cur = inv.active === 4 && inv.grenade ? kinds.indexOf(inv.grenade.id) : -1;
    const next = kinds[(cur + 1) % kinds.length];
    if (inv.active === 4 && inv.grenade?.id === next) return true;
    inv.grenade = newWeapon(next);
  } else if (!weaponInSlot(inv, slot)) return false;
  else if (inv.active === slot) return true;
  const prev = activeWeapon(inv);
  if (prev) {
    prev.zoom = 0;
    prev.reloadLeft = 0;
  }
  if (inv.active !== slot) inv.last = inv.active;
  inv.active = slot;
  const w = activeWeapon(inv)!;
  w.deployLeft = WEAPONS[w.id].deploy;
  return true;
}

/** Best weapon to hold after the current one is gone (thrown / dropped). */
export function fallbackSlot(inv: Inventory) {
  const order: SlotNo[] = [1, 2, 3];
  selectSlot(inv, order.find((s) => weaponInSlot(inv, s)) ?? 3);
}

/** Remove the grenade in hand after it was thrown. */
export function spendGrenade(inv: Inventory) {
  if (!inv.grenade) return;
  const i = inv.grenades.indexOf(inv.grenade.id);
  if (i >= 0) inv.grenades.splice(i, 1);
  inv.grenade = null;
  const back = inv.last;
  inv.active = 3;
  if (inv.grenades.length) selectSlot(inv, 4);
  else if (back !== 4 && back !== 3 && weaponInSlot(inv, back)) selectSlot(inv, back);
  else fallbackSlot(inv);
}

/** Put a weapon into its slot (picking it up). Returns what was in that slot. */
export function equip(inv: Inventory, w: WeaponState): WeaponState | null {
  const slot = WEAPONS[w.id].slot;
  if (slot !== 1 && slot !== 2) return null;
  const old = slot === 1 ? inv.primary : inv.secondary;
  if (slot === 1) inv.primary = w;
  else inv.secondary = w;
  if (inv.active === slot) inv.active = 3;
  selectSlot(inv, slot);
  return old;
}

/** Take the active gun out of the inventory (G). Knife and empty hands cannot be dropped. */
export function dropActive(inv: Inventory): WeaponState | null {
  const w = activeWeapon(inv);
  if (!w || inv.active === 3 || inv.active === 4) return null;
  if (inv.active === 1) inv.primary = null;
  else inv.secondary = null;
  w.zoom = 0;
  w.reloadLeft = 0;
  inv.active = 3;
  fallbackSlot(inv);
  return w;
}

/* ───────────── collision ───────────── */

export interface Solid {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/** Whether a cylinder (feet at `y`, `height` tall) at x/z overlaps a solid (each map keeps walkers inside its own edge). */
export function blocked(x: number, z: number, solids: Solid[], radius: number = MOVE.radius, y = 0, height = 1.8): boolean {
  for (const s of solids) {
    if (s.max.y <= y + MOVE.stepHeight || s.min.y >= y + height) continue;
    const dx = x - Math.max(s.min.x, Math.min(s.max.x, x));
    const dz = z - Math.max(s.min.z, Math.min(s.max.z, z));
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

/** `blocked` for a fixed set of solids, with the solids sorted into square buckets so a query only looks at the ones nearby. */
export function makeBlocked(solids: Solid[], radius: number, bucket = 12): (x: number, z: number) => boolean {
  const cells = new Map<number, Solid[]>();
  const key = (i: number, j: number) => (i + 1000) * 4096 + (j + 1000);
  for (const s of solids) {
    if (s.max.y <= MOVE.stepHeight || s.min.y >= 1.8) continue;
    const i0 = Math.floor((s.min.x - radius) / bucket);
    const i1 = Math.floor((s.max.x + radius) / bucket);
    const j0 = Math.floor((s.min.z - radius) / bucket);
    const j1 = Math.floor((s.max.z + radius) / bucket);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        const list = cells.get(k);
        if (list) list.push(s);
        else cells.set(k, [s]);
      }
  }
  return (x, z) => {
    const list = cells.get(key(Math.floor(x / bucket), Math.floor(z / bucket)));
    if (!list) return false;
    for (const s of list) {
      const dx = x - Math.max(s.min.x, Math.min(s.max.x, x));
      const dz = z - Math.max(s.min.z, Math.min(s.max.z, z));
      if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
  };
}

/** Height of the highest surface under a cylinder that its feet can stand on; `floor` is the ground below every box. */
export function groundHeight(x: number, z: number, solids: Solid[], y: number, radius: number = MOVE.radius, floor = 0): number {
  let g = floor;
  for (const s of solids) {
    if (s.max.y > y + MOVE.stepHeight || s.max.y <= g) continue;
    const dx = x - Math.max(s.min.x, Math.min(s.max.x, x));
    const dz = z - Math.max(s.min.z, Math.min(s.max.z, z));
    if (dx * dx + dz * dz < radius * radius * 0.6) g = s.max.y;
  }
  return g;
}

/** Ray / box slab test. Returns [entry, exit] distances along a unit direction, or null. */
export function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, s: Solid, far: number): [number, number] | null {
  let t0 = 0;
  let t1 = far;
  const axes: [number, number, number, number][] = [
    [ox, dx, s.min.x, s.max.x],
    [oy, dy, s.min.y, s.max.y],
    [oz, dz, s.min.z, s.max.z]
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let a = (lo - o) / d;
    let b = (hi - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}
