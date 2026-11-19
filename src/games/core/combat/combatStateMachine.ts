/**
 * Gameplay state → animation choice, kept free of three.js and React so the rules read (and test) on their own. The weapon state
 * (game.md 6.1) is derived from the gameplay weapon; the animation state picks a base track set (locomotion, stance, jump, death),
 * an upper-body track (aim, fire, reload, equip) and a hit-reaction overlay.
 */

export type CombatStance = 'stand' | 'crouch' | 'prone';
export type HitSide = 'front' | 'back' | 'left' | 'right';
export type WeaponPhase = 'UNARMED' | 'EQUIPPING' | 'READY' | 'AIMING' | 'FIRING' | 'RELOADING' | 'UNEQUIPPING' | 'DISABLED';

/** A shot keeps the firing pose this long, so automatic fire reads as one held pose rather than a flicker per bullet. */
export const FIRE_HOLD_S = 0.28;
/**
 * A pistol stays up in the aim pose this long after a shot: its idle holds it low, so dropping back between single shots made the
 * upper body pop up and down on every click.
 */
export const PISTOL_RAISED_AFTER_SHOT_S = 1.5;
const MOVING_SPEED = 0.3;
const RUN_SPEED = 3;
const CRAWL_SPEED = 0.15;
const TURN_RATE = 1.4;
const PRONE_TURN_RATE = 0.8;
/** Moving faster than this skips a stance transition clip and goes straight to the moving pose. */
const TRANSITION_MAX_SPEED = 0.6;

export interface WeaponPhaseInput {
  alive: boolean;
  holdsGun: boolean;
  unequipping: boolean;
  deployLeft: number;
  reloadLeft: number;
  sinceShot: number;
  aiming: boolean;
}

export function weaponPhase(s: WeaponPhaseInput): WeaponPhase {
  if (!s.alive) return 'DISABLED';
  if (s.unequipping) return 'UNEQUIPPING';
  if (!s.holdsGun) return 'UNARMED';
  if (s.deployLeft > 0) return 'EQUIPPING';
  if (s.reloadLeft > 0) return 'RELOADING';
  if (s.sinceShot < FIRE_HOLD_S) return 'FIRING';
  return s.aiming ? 'AIMING' : 'READY';
}

/** Which side a hit came from, given the attacker's direction in body space (x right, z forward). */
export function hitSideOf(localX: number, localZ: number): HitSide {
  if (Math.abs(localZ) >= Math.abs(localX)) return localZ >= 0 ? 'front' : 'back';
  return localX >= 0 ? 'right' : 'left';
}

/** Where the rifle is around a sprint: in the hands, going onto the back, on the back, or being taken back into the hands. */
export type GunCarry = 'hands' | 'stowing' | 'back' | 'drawing';

/** Which set of clips the gun in hand uses (see PISTOL_VARIANT in combatCatalog.ts). */
export type GunClass = 'rifle' | 'pistol';

export interface CombatFrame {
  now: number;
  gunClass: GunClass;
  /** Seen through the eyes: a ready gun is held up as when aiming (the hip pose would be out of view). */
  firstPerson: boolean;
  alive: boolean;
  diedAt: number;
  deathSide: HitSide;
  stance: CombatStance;
  stanceFrom: CombatStance;
  stanceAt: number;
  /** Ground velocity in body space (m/s). */
  forward: number;
  right: number;
  sprinting: boolean;
  carry: GunCarry;
  /** When the rifle started going onto the back (or coming back from it). */
  carryAt: number;
  airborne: boolean;
  vy: number;
  airAt: number;
  landedAt: number;
  /** Turn of the body (rad/s, + = left). */
  turnRate: number;
  phase: WeaponPhase;
  /** Seconds since the gun in hand last fired. */
  sinceShot: number;
  aiming: boolean;
  aimChangedAt: number;
  reloadProgress: number;
  reloadEmpty: boolean;
  deployProgress: number;
  unequipAt: number;
  hitAt: number;
  hitSide: HitSide;
}

/**
 * One clip to play: `loop` runs on its own clock (scaled by `moveSpeed` for movement), `once` plays from `startedAt`, `fit` shows
 * the clip at `progress` of a game action.
 */
export type CombatTrack =
  | { slot: string; weight: number; mode: 'loop'; moveSpeed: number; family?: string }
  | { slot: string; weight: number; mode: 'once'; startedAt: number }
  | { slot: string; weight: number; mode: 'fit'; progress: number };

export interface CombatSelection {
  base: CombatTrack[];
  upper: CombatTrack | null;
  overlay: CombatTrack | null;
  dead: boolean;
}

/** Seconds a slot's clip lasts at its configured speed, or null while it is not loaded (or not set). */
export type ClipLength = (slot: string) => number | null;

const loop = (slot: string, moveSpeed = 0, weight = 1, family?: string): CombatTrack => ({ slot, weight, mode: 'loop', moveSpeed, family });
const once = (slot: string, startedAt: number): CombatTrack => ({ slot, weight: 1, mode: 'once', startedAt });
const fit = (slot: string, progress: number): CombatTrack => ({ slot, weight: 1, mode: 'fit', progress });
const playing = (length: ClipLength, slot: string, since: number) => since >= 0 && since < (length(slot) ?? 0);

/**
 * Split a movement direction over the two nearest of four direction clips (a 2D blend space). The tracks share a `family` (the
 * forward clip), so turning while moving shifts the weights without counting as a change of state.
 */
export function directionalTracks(forward: number, right: number, slots: [string, string, string, string]): CombatTrack[] {
  const speed = Math.hypot(forward, right);
  const [fwd, bwd, left, right_] = slots;
  const angle = Math.atan2(right, forward);
  const quarter = Math.PI / 2;
  const sector = Math.min(1, Math.floor(Math.abs(angle) / quarter + 1e-9));
  const t = Math.min(1, (Math.abs(angle) - sector * quarter) / quarter);
  const side = angle >= 0 ? right_ : left;
  const [a, b] = sector === 0 ? [fwd, side] : [side, bwd];
  const tracks = [loop(a, speed, 1 - t, fwd), loop(b, speed, t, fwd)].filter((track) => track.weight > 1e-3);
  return tracks.sort((x, y) => y.weight - x.weight);
}

const TRANSITIONS: Partial<Record<`${CombatStance}>${CombatStance}`, string>> = {
  'stand>crouch': 'Stand_To_Crouch', 'crouch>stand': 'Crouch_To_Stand', 'stand>prone': 'Stand_To_Prone',
  'crouch>prone': 'Crouch_To_Prone', 'prone>stand': 'Prone_To_Stand', 'prone>crouch': 'Prone_To_Crouch',
};

const DEATH: Record<HitSide, string> = { front: 'Death_Front', back: 'Death_Back', left: 'Death_Left', right: 'Death_Right' };
const HIT: Record<HitSide, string> = { front: 'Hit_Front', back: 'Hit_Back', left: 'Hit_Left', right: 'Hit_Right' };

function deathTrack(f: CombatFrame): CombatTrack {
  if (f.stance === 'prone') return once('Death_Prone', f.diedAt);
  if (f.stance === 'crouch') return once('Death_Crouch', f.diedAt);
  return once(DEATH[f.deathSide], f.diedAt);
}

function locomotion(f: CombatFrame, armed: boolean, speed: number): CombatTrack[] {
  if (f.stance === 'prone') {
    if (speed > CRAWL_SPEED) return [loop(f.forward >= -CRAWL_SPEED ? 'Prone_Crawl_Fwd' : 'Prone_Crawl_Bwd', speed)];
    if (Math.abs(f.turnRate) > PRONE_TURN_RATE) return [loop(f.turnRate > 0 ? 'Prone_Turn_Left' : 'Prone_Turn_Right')];
    if (armed && f.phase === 'FIRING') return [loop('Prone_Fire')];
    return [loop('Prone_Idle')];
  }
  if (!armed) {
    if (f.stance === 'crouch') return [loop(speed > MOVING_SPEED ? 'Unarmed_Crouch_Walk' : 'Unarmed_Crouch_Idle', speed)];
    if (f.sprinting) return [loop('Unarmed_Sprint', speed)];
    if (speed > RUN_SPEED) return [loop('Unarmed_Run', speed)];
    return [loop(speed > MOVING_SPEED ? 'Unarmed_Walk' : 'Unarmed_Idle', speed)];
  }
  // aiming: slow steps in any direction with the gun kept level (the upper body layer holds the aim on top)
  const aimWalk = f.aiming && !f.sprinting && speed > MOVING_SPEED;
  if (f.stance === 'crouch') {
    if (speed <= MOVING_SPEED) return [loop('Crouch_Idle')];
    if (aimWalk) return directionalTracks(f.forward, f.right, ['Crouch_Aim_Walk_Fwd', 'Crouch_Aim_Walk_Bwd', 'Crouch_Aim_Walk_Left', 'Crouch_Aim_Walk_Right']);
    return directionalTracks(f.forward, f.right, ['Crouch_Walk', 'Crouch_Walk_Bwd', 'Crouch_Walk_Left', 'Crouch_Walk_Right']);
  }
  if (aimWalk) return directionalTracks(f.forward, f.right, ['Rifle_Aim_Walk_Fwd', 'Rifle_Aim_Walk_Bwd', 'Rifle_Aim_Walk_Left', 'Rifle_Aim_Walk_Right']);
  if (f.sprinting) return [loop(f.carry === 'hands' ? 'Rifle_Sprint' : 'Sprint_Gun_On_Back', speed)];
  if (speed > RUN_SPEED) return directionalTracks(f.forward, f.right, ['Rifle_Run', 'Rifle_Run_Bwd', 'Rifle_Run_Left', 'Rifle_Run_Right']);
  if (speed > MOVING_SPEED) return directionalTracks(f.forward, f.right, ['Rifle_Walk_Fwd', 'Rifle_Walk_Bwd', 'Rifle_Walk_Left', 'Rifle_Walk_Right']);
  if (Math.abs(f.turnRate) > TURN_RATE) return [loop(f.turnRate > 0 ? 'Rifle_Turn_Left' : 'Rifle_Turn_Right')];
  return [loop('Rifle_Idle')];
}

function baseTracks(f: CombatFrame, length: ClipLength, armed: boolean): CombatTrack[] {
  const speed = Math.hypot(f.forward, f.right);
  const transition = TRANSITIONS[`${f.stanceFrom}>${f.stance}`];
  if (transition && speed < TRANSITION_MAX_SPEED && playing(length, transition, f.now - f.stanceAt)) return [once(transition, f.stanceAt)];
  if (f.stance === 'prone' && armed && f.phase === 'RELOADING') return [fit('Rifle_Reload_Prone', f.reloadProgress)];
  if (f.airborne) {
    if (f.vy > 0 && playing(length, 'Rifle_Jump', f.now - f.airAt)) return [once('Rifle_Jump', f.airAt)];
    return [loop('Rifle_Fall')];
  }
  if (speed < 1 && playing(length, 'Rifle_Land', f.now - f.landedAt)) return [once('Rifle_Land', f.landedAt)];
  return locomotion(f, armed, speed);
}

function reloadSlot(f: CombatFrame): string {
  // the third-person reload clips swing the gun down to the hip, out of a first-person view: it has its own slot
  if (f.firstPerson) return 'FP_Reload';
  if (f.stance === 'crouch') return 'Rifle_Reload_Crouch';
  const speed = Math.hypot(f.forward, f.right);
  if (speed > RUN_SPEED) return 'Rifle_Reload_Run';
  if (speed > MOVING_SPEED) return 'Rifle_Reload_Moving';
  return f.reloadEmpty ? 'Rifle_Reload_Empty' : 'Rifle_Reload_Tactical';
}

function upperTrack(f: CombatFrame, length: ClipLength): CombatTrack | null {
  if (f.carry === 'stowing') return once('Rifle_Stow_Back', f.carryAt);
  if (f.carry === 'drawing') return fit('Rifle_Draw_Back', f.deployProgress);
  if (f.stance === 'prone' || f.sprinting) return null;
  switch (f.phase) {
    case 'EQUIPPING': return fit('Rifle_Equip', f.deployProgress);
    case 'UNEQUIPPING': return once('Rifle_Unequip', f.unequipAt);
    case 'RELOADING': return fit(reloadSlot(f), f.reloadProgress);
    // through the eyes a ready gun is already held as when aiming (see READY), so firing keeps that pose instead of dropping to the hip
    case 'FIRING': return loop(f.aiming || f.firstPerson ? 'Rifle_Fire_ADS' : 'Rifle_Fire_Hip');
    case 'AIMING':
      if (playing(length, 'Rifle_Aim_Enter', f.now - f.aimChangedAt)) return once('Rifle_Aim_Enter', f.aimChangedAt);
      return loop(f.stance === 'crouch' ? 'Crouch_Aim_Idle' : 'Rifle_Aim_Idle');
    case 'READY':
      if (f.firstPerson || (f.gunClass === 'pistol' && f.sinceShot < PISTOL_RAISED_AFTER_SHOT_S)) {
        return loop(f.stance === 'crouch' ? 'Crouch_Aim_Idle' : 'Rifle_Aim_Idle');
      }
      return playing(length, 'Rifle_Aim_Exit', f.now - f.aimChangedAt) ? once('Rifle_Aim_Exit', f.aimChangedAt) : null;
    default: return null;
  }
}

/** The tracks to play this frame. `hitSeconds` is how long a hit reaction lasts. */
export function selectCombatTracks(f: CombatFrame, length: ClipLength, hitSeconds: number): CombatSelection {
  if (!f.alive) return { base: [deathTrack(f)], upper: null, overlay: null, dead: true };
  const armed = f.phase !== 'UNARMED';
  const sinceHit = f.now - f.hitAt;
  const hit = sinceHit >= 0 && sinceHit < hitSeconds;
  if (hit && f.stance === 'prone') return { base: [once('Hit_Prone', f.hitAt)], upper: null, overlay: null, dead: false };
  const overlay = hit && armed ? once(f.stance === 'crouch' ? 'Hit_Crouch' : HIT[f.hitSide], f.hitAt) : null;
  return { base: baseTracks(f, length, armed), upper: armed ? upperTrack(f, length) : null, overlay, dead: false };
}
