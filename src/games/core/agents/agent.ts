import * as THREE from 'three';
import { Inventory, MOVE, newInventory, Team } from '../rules';
import { BotBody, CROUCH_DROP } from '../models';
import type { Brain } from './ai';
import type { FighterGear } from './fighterGear';

/** What a player or bot wants to do this frame; the engine applies it the same way for both. */
export interface Input {
  /** Forward / right, -1..1. */
  f: number;
  r: number;
  walk: boolean;
  /** Run faster than normal (forward, standing, not shooting). */
  sprint: boolean;
  crouch: boolean;
  jump: boolean;
  fire: boolean;
  alt: boolean;
  reload: boolean;
}
/** Seconds a sighting keeps an enemy on the radar. */
const SPOTTED_S = 0.6;

export const idleInput = (): Input => ({ f: 0, r: 0, walk: false, sprint: false, crouch: false, jump: false, fire: false, alt: false, reload: false });

/** A combatant: the human player or a bot. Feet at `pos`, view along yaw / pitch (yaw 0 looks toward -z). */
export class Agent {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = true;
  /** 0 = standing, 1 = fully crouched (animated). */
  crouch = 0;
  /** 0 = up, 1 = lying flat (animated; only the player goes prone). */
  prone = 0;
  /** -1 = leaning fully left … 1 = fully right (animated). */
  lean = 0;
  /** Eye shift (m) at full lean, before the body's scale. */
  leanReach = 0;
  sprinting = false;
  /** In water too deep to stand in: cannot shoot, aim, jump or crouch. */
  swimming = false;
  /** Still on the way down to the battle royale island (null once landed, and in 5 vs 5). */
  health = 100;
  alive = true;
  /** Money for a game with an economy (the CS Lite shop); the game sets it at the start of a match. */
  money = 0;
  inv: Inventory;
  kills = 0;
  deaths = 0;
  assists = 0;
  headshots = 0;
  mvps = 0;
  roundKills = 0;
  /** Damage taken this life, by attacker (for assists). */
  readonly damageFrom = new Map<Agent, number>();
  blindUntil = 0;
  /** Movement slow-down after being hit ("tagging"). */
  tagUntil = 0;
  diedAt = 0;
  /** Seen by the other team recently (shown on their radar). */
  spottedUntil = 0;
  /** Where the other team last saw this fighter (their radar keeps a "?" there for a while after losing sight). */
  readonly spottedPos = new THREE.Vector3();
  input: Input = idleInput();
  fireLatch = false;
  altLatch = false;
  jumpLatch = false;
  /** Scope level to restore after the AWP bolt cycles. */
  resumeZoom = 0;
  /** Grenade pin pulled with primary or secondary attack. */
  pin: '' | 'fire' | 'alt' = '';
  stepDist = 0;
  body: BotBody | null = null;
  brain: Brain | null = null;
  /** Body size relative to the 1.72 m soldier (the player's character: race and height slider). */
  scale = 1;
  /** Who is on whose side: CT / T in the team mode, everyone alone in battle royale. */
  squad: number;
  /** What the game being played adds to this fighter (see fighterGear.ts); null plays by the base rules. */
  gear: FighterGear | null = null;

  constructor(readonly id: number, readonly name: string, readonly team: Team, readonly isPlayer: boolean, squad?: number) {
    this.squad = squad ?? (team === 'CT' ? 0 : 1);
    this.inv = newInventory(team);
  }

  /** Seen by the other team now: shown on their radar for `forS` seconds, and remembered there as last seen afterwards. */
  spot(now: number, forS = SPOTTED_S) {
    this.spottedUntil = now + forS;
    this.spottedPos.copy(this.pos);
  }

  get eyeHeight() {
    const upright = MOVE.eyeStand + (MOVE.eyeCrouch - MOVE.eyeStand) * this.crouch;
    return (upright + (MOVE.eyeProne - upright) * this.prone) * this.scale;
  }
  /** Eye position: leaning moves it sideways (and a little down), so a player can look and shoot past a corner. */
  eye(out = new THREE.Vector3()) {
    const side = this.lean * this.leanReach * this.scale;
    return out.set(this.pos.x + Math.cos(this.yaw) * side, this.pos.y + this.eyeHeight - Math.abs(side) * 0.15, this.pos.z - Math.sin(this.yaw) * side);
  }
  head(out = new THREE.Vector3()) {
    return this.lowered(out, HEAD.y, PRONE_HEAD.y);
  }
  chest(out = new THREE.Vector3()) {
    return this.lowered(out, 1.28, 0.25);
  }
  /** A body point at `upright` height standing, lowered by the crouch and pulled down to `flat` lying prone. */
  private lowered(out: THREE.Vector3, upright: number, flat: number) {
    const y = upright - this.crouch * CROUCH_DROP;
    return out.set(this.pos.x, this.pos.y + (y + (flat - y) * this.prone) * this.scale, this.pos.z);
  }
  /** Unit view direction. */
  forward(out = new THREE.Vector3()) {
    return dirFromAngles(this.yaw, this.pitch, out);
  }
  get speed2d() {
    return Math.hypot(this.vel.x, this.vel.z);
  }
}

export function dirFromAngles(yaw: number, pitch: number, out = new THREE.Vector3()) {
  return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

/** Yaw / pitch that look from `a` to `b`. */
export function anglesTo(a: THREE.Vector3, b: THREE.Vector3): [number, number] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return [Math.atan2(-dx, -dz), Math.atan2(b.y - a.y, Math.hypot(dx, dz))];
}

/** Signed smallest difference between two angles. */
export const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Same side (never shoot or blind-check each other as enemies). */
export const allied = (a: Agent, b: Agent) => a.squad === b.squad;

/** Hit boxes in body space (x right, y up, z forward), standing; `drops` boxes move down with the crouch. */
export const HITBOXES = [
  { group: 'chest' as const, min: [-0.24, 1.08, -0.15], max: [0.24, 1.5, 0.15], drops: true },
  { group: 'chest' as const, min: [-0.06, 1.12, 0.1], max: [0.3, 1.42, 0.55], drops: true }, // arms holding the gun
  { group: 'stomach' as const, min: [-0.2, 0.84, -0.13], max: [0.2, 1.08, 0.13], drops: true },
  { group: 'legs' as const, min: [-0.22, 0, -0.14], max: [0.22, 0.84, 0.14], drops: false }
];
export const HEAD = { y: 1.62, r: 0.15 };

/** Lying prone the body stretches along the view, head forward (body space, the hips at the origin). */
export const PRONE_HITBOXES = [
  { group: 'chest' as const, min: [-0.26, 0, 0.05], max: [0.26, 0.42, 0.62] },
  { group: 'stomach' as const, min: [-0.22, 0, -0.32], max: [0.22, 0.36, 0.05] },
  { group: 'legs' as const, min: [-0.26, 0, -1.3], max: [0.26, 0.3, -0.32] }
];
export const PRONE_HEAD = { y: 0.3, z: 0.8, r: 0.15 };
