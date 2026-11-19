import * as THREE from 'three';
import { Agent, allied, angleDiff, anglesTo, idleInput } from './agent';
import { endClimb, maybeStartClimb, nextClimbStep, type Climb, type ClimbPlan } from './botClimb';
import { NavGrid, P2 } from './nav';
import { activeWeapon, aimPunch, selectSlot, Team, WEAPONS } from '../rules';
import { isScopedGun } from '../weapons/gunClass';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Skill {
  /** Seconds before the first shot after spotting someone. */
  reaction: [number, number];
  /** Initial aim error (rad) that settles over `settle` seconds. */
  aimError: number;
  settle: number;
  headChance: number;
  /** Max turn speed (rad/s). */
  turn: number;
  /** How much of the spray pattern the bot pulls down against. */
  comp: number;
  /** Scales how long the bot sprays before pausing to reset recoil. */
  burst: number;
}

export const SKILLS: Record<Difficulty, Skill> = {
  easy: { reaction: [0.55, 0.9], aimError: 0.14, settle: 0.7, headChance: 0.15, turn: 4, comp: 0.35, burst: 0.6 },
  normal: { reaction: [0.32, 0.55], aimError: 0.09, settle: 0.45, headChance: 0.35, turn: 7, comp: 0.65, burst: 1 },
  hard: { reaction: [0.18, 0.32], aimError: 0.05, settle: 0.28, headChance: 0.6, turn: 11, comp: 0.85, burst: 1.3 }
};

export interface Brain {
  target: Agent | null;
  seenAt: number;
  lastKnown: THREE.Vector3 | null;
  reaction: number;
  errYaw: number;
  errPitch: number;
  aimHead: boolean;
  path: P2[];
  goal: P2 | null;
  repathAt: number;
  /** When the bot leaves the spot it reached (0 = not there yet). */
  holdUntil: number;
  burstPause: number;
  strafe: number;
  strafeT: number;
  crouchSpray: boolean;
  stuckT: number;
  unstickT: number;
  semiToggle: boolean;
  /** Battle royale: the watchtower this bot is climbing or keeping watch from. */
  climb: ClimbPlan | null;
  climbedAt: number;
}

export const newBrain = (): Brain => ({
  target: null, seenAt: -99, lastKnown: null, reaction: 0, errYaw: 0, errPitch: 0, aimHead: false, path: [], goal: null, repathAt: 0,
  holdUntil: 0, burstPause: 0, strafe: 1, strafeT: 0, crouchSpray: false, stuckT: 0, unstickT: 0, semiToggle: false,
  climb: null, climbedAt: -999
});

/** What the engine exposes to bots. */
export interface AiWorld {
  now: number;
  /** Seconds since the round went live (negative during freeze time). */
  liveTime: number;
  agents: Agent[];
  nav: NavGrid;
  points: { attack: P2[]; hold: Record<Team, P2[]> };
  /** Recent gunshots bots can hear. */
  heard: { pos: THREE.Vector3; squad: number; t: number }[];
  /** Battle royale: where to go when nobody is in sight (loot, the safe zone, a patrol point). */
  objective?: (a: Agent) => P2 | null;
  /** Watchtowers bots can climb (battle royale). */
  climbs: readonly Climb[];
  skill: Skill;
  /** Whether `a` fights `e`; without it everyone outside the squad is an enemy. */
  isHostile?(a: Agent, e: Agent): boolean;
  /** Clear line of sight between two points (walls and smoke). */
  canSee(from: THREE.Vector3, to: THREE.Vector3): boolean;
}

/** Bots do not see past the fog. */
const VISION = 80;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const dist2 = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Hold the best weapon that still has ammo. */
function manageWeapon(a: Agent) {
  const inv = a.inv;
  if ((activeWeapon(inv)?.reloadLeft ?? 0) > 0) return;
  const hasAmmo = (s: typeof inv.primary) => !!s && s.ammo + s.reserve > 0;
  const want = hasAmmo(inv.primary) ? 1 : hasAmmo(inv.secondary) ? 2 : 3;
  if (inv.active !== want) selectSlot(inv, want);
}

/** Turn toward a yaw / pitch at a limited speed. */
function turnTo(a: Agent, yaw: number, pitch: number, rate: number, dt: number) {
  const max = rate * dt;
  a.yaw += Math.max(-max, Math.min(max, angleDiff(yaw, a.yaw)));
  a.pitch += Math.max(-max, Math.min(max, pitch - a.pitch));
}

/** Set f / r input to walk toward a world direction regardless of where the bot looks. */
function steer(a: Agent, dx: number, dz: number) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return;
  dx /= len;
  dz /= len;
  a.input.f = dx * -Math.sin(a.yaw) + dz * -Math.cos(a.yaw);
  a.input.r = dx * Math.cos(a.yaw) + dz * -Math.sin(a.yaw);
}

/** Bend a walking direction away from what is right in front of the bot: try it, then turn up to ~90° either way until the spots 0.7 and 1.4 m ahead are open. */
function avoid(a: Agent, w: AiWorld, dx: number, dz: number): [number, number] {
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return [dx, dz];
  const ux = dx / len;
  const uz = dz / len;
  const open = (x: number, z: number) => !w.nav.blockedAt(a.pos.x + x * 0.7, a.pos.z + z * 0.7) && !w.nav.blockedAt(a.pos.x + x * 1.4, a.pos.z + z * 1.4);
  if (open(ux, uz)) return [dx, dz];
  const side = a.brain!.strafe;
  for (const turn of [0.5, 1.0, 1.55]) {
    for (const s of [side, -side]) {
      const c = Math.cos(turn * s);
      const sn = Math.sin(turn * s);
      const vx = ux * c - uz * sn;
      const vz = ux * sn + uz * c;
      if (open(vx, vz)) return [vx * len, vz * len];
    }
  }
  return [dx, dz];
}

/** Follow (and refresh) a nav path to a point. Returns the next waypoint, or null once there. */
function follow(a: Agent, w: AiWorld, goal: P2): P2 | null {
  const b = a.brain!;
  if (!b.goal || dist2(b.goal, goal) > 3 || w.now > b.repathAt || !b.path.length) {
    b.goal = goal;
    b.path = w.nav.path(a.pos, goal);
    b.repathAt = w.now + 2.5;
  }
  while (b.path.length && dist2(b.path[0], a.pos) < 1.2) b.path.shift();
  if (!b.path.length) return dist2(goal, a.pos) < 2 ? null : goal;
  return b.path[0];
}

function chooseObjective(a: Agent, w: AiWorld): P2 {
  const enemy: Team = a.team === 'CT' ? 'T' : 'CT';
  // defenders hold for a while, then everyone pushes toward the other side
  if (a.team === 'CT' && w.liveTime < 30) return pick(w.points.hold.CT);
  if (Math.random() < 0.35) return pick(w.points.hold[enemy]);
  return pick(w.points.attack);
}

export function think(a: Agent, w: AiWorld, dt: number) {
  const b = a.brain!;
  a.input = idleInput();
  if (!a.alive) return;
  const sk = w.skill;
  manageWeapon(a);
  const weapon = activeWeapon(a.inv);
  const eye = a.eye();
  const blind = w.now < a.blindUntil;

  // ── perception: closest visible enemy inside the field of view ──
  let target: Agent | null = null;
  let aimPoint: THREE.Vector3 | null = null;
  let best = Infinity;
  if (!blind && w.liveTime > -0.5) {
    for (const e of w.agents) {
      if (!e.alive || (w.isHostile ? !w.isHostile(a, e) : allied(e, a))) continue;
      const d = e.pos.distanceTo(a.pos);
      if (d > VISION || d > best) continue;
      const inFov = Math.abs(angleDiff(anglesTo(a.pos, e.pos)[0], a.yaw)) < 1.25 || d < 4 || e === b.target;
      if (!inFov) continue;
      const point = [e.head(), e.chest()].find((p) => w.canSee(eye, p));
      if (point) {
        target = e;
        aimPoint = point;
        best = d;
      }
    }
  }
  if (target) target.spot(w.now);

  // ── hearing: investigate enemy gunfire ──
  if (!target && !blind)
    for (const h of w.heard)
      if (h.squad !== a.squad && w.now - h.t < 1.2 && h.pos.distanceTo(a.pos) < 55 && (!b.lastKnown || w.now - b.seenAt > 2)) {
        b.lastKnown = h.pos.clone();
        b.seenAt = w.now - 2;
      }

  if (weapon && weapon.id !== 'knife' && weapon.reloadLeft <= 0 && weapon.reserve > 0 && (weapon.ammo === 0 || (!target && weapon.ammo < WEAPONS[weapon.id].magazine * 0.4)))
    a.input.reload = true;

  if (target && aimPoint && weapon) {
    if (b.target !== target || w.now - b.seenAt > 1.2) {
      b.reaction = rand(sk.reaction[0], sk.reaction[1]);
      const mag = sk.aimError * rand(0.6, 1.2);
      const ang = Math.random() * Math.PI * 2;
      b.errYaw = Math.cos(ang) * mag;
      b.errPitch = Math.sin(ang) * mag * 0.6;
      // nobody goes for the head across the map
      b.aimHead = Math.random() < sk.headChance * (best < 25 ? 1 : best < 45 ? 0.5 : 0.15);
      b.crouchSpray = Math.random() < 0.35;
    }
    b.target = target;
    b.seenAt = w.now;
    b.lastKnown = target.pos.clone();
    let point = b.aimHead ? target.head() : target.chest();
    if (!w.canSee(eye, point)) point = aimPoint;
    const d = eye.distanceTo(point);
    let [yaw, pitch] = anglesTo(eye, point);
    // pull against the spray like a player would (bullets go to view - punch on yaw, + punch on pitch)
    const [px, py] = aimPunch(weapon.id, weapon.recoil);
    yaw += px * sk.comp;
    pitch -= py * sk.comp;
    const settle = Math.exp(-dt / sk.settle);
    b.errYaw *= settle;
    b.errPitch *= settle;
    turnTo(a, yaw + b.errYaw, pitch + b.errPitch, sk.turn, dt);
    const off = Math.hypot(angleDiff(yaw, a.yaw), pitch - a.pitch);
    const tolerance = Math.atan2(0.32, d) + 0.012;
    const def = WEAPONS[weapon.id];
    if (isScopedGun(weapon.id)) weapon.zoom = weapon.cooldown > 0 ? 0 : 1;
    b.reaction -= dt;
    let firing = false;
    if (b.reaction <= 0 && off < tolerance) {
      if (weapon.id === 'knife') firing = d < 1.9;
      else if (def.auto) {
        const maxBurst = Math.max(2, Math.round((d > 35 ? 3 : d > 18 ? 6 : 30) * sk.burst));
        if (b.burstPause > 0) b.burstPause -= dt;
        else {
          firing = true;
          if (weapon.recoil + 1 >= maxBurst) b.burstPause = rand(0.25, 0.5);
        }
      } else {
        // semi-automatic: release between shots and, at range, wait for first-shot accuracy
        b.semiToggle = !b.semiToggle;
        firing = b.semiToggle && (d < 12 || weapon.recoil < 0.8);
      }
    }
    a.input.fire = firing;
    // movement while engaged: stop to shoot (counter-strafe), jiggle between bursts, rush with a knife
    if (weapon.id === 'knife') steer(a, target.pos.x - a.pos.x, target.pos.z - a.pos.z);
    else if (!firing || def.moveInacc < 0.05) {
      b.strafeT -= dt;
      if (b.strafeT <= 0) {
        b.strafe = -b.strafe;
        b.strafeT = rand(0.3, 0.8);
      }
      // sidestep the other way when a wall is right there
      const right = [Math.cos(a.yaw), -Math.sin(a.yaw)];
      if (w.nav.blockedAt(a.pos.x + right[0] * b.strafe * 0.9, a.pos.z + right[1] * b.strafe * 0.9)) {
        b.strafe = -b.strafe;
        b.strafeT = rand(0.3, 0.8);
      }
      a.input.r = b.strafe;
      a.input.f = d > 30 ? 0.4 : 0;
      a.input.walk = d > 40;
    }
    const tryingToMove = !firing && (Math.abs(a.input.f) + Math.abs(a.input.r) > 0.1);
    b.stuckT = tryingToMove && a.speed2d < 0.55 ? b.stuckT + dt : a.speed2d > 0.8 ? 0 : b.stuckT;
    if (b.stuckT > 0.85) {
      b.stuckT = 0;
      b.unstickT = 0.55;
      b.strafe = Math.random() < 0.5 ? -1 : 1;
    }
    if (b.unstickT > 0) {
      b.unstickT -= dt;
      a.input.r = b.strafe;
      a.input.f = -0.3;
      a.input.jump = b.unstickT > 0.4;
    }
    a.input.crouch = firing && b.crouchSpray && d > 15;
    return;
  }

  // ── no enemy in sight ──
  if (b.target && w.now - b.seenAt > 0.6) b.target = null;
  if (weapon && isScopedGun(weapon.id)) weapon.zoom = 0;
  if (blind) {
    a.input.f = -0.6;
    return;
  }
  if (w.liveTime < 0) return;
  let goal: P2;
  let quiet = false;
  let holding = false;
  /** Walk straight at the goal instead of over the path grid (the grid does not know stairs). */
  let direct = false;
  const climb = w.objective ? nextClimbStep(a, w.now) : null;
  if (b.lastKnown && w.now - b.seenAt < 7) {
    goal = { x: b.lastKnown.x, z: b.lastKnown.z };
    quiet = b.lastKnown.distanceTo(a.pos) < 18;
    if (dist2(goal, a.pos) < 2) b.lastKnown = null;
  } else if (climb) {
    holding = climb.kind === 'perch';
    direct = climb.kind === 'direct';
    goal = climb.kind === 'perch' ? a.pos : climb.point;
  } else if (w.objective) {
    // battle royale: the engine decides (loot, zone, patrol); ask again on arrival or every few seconds
    if (!b.goal || dist2(b.goal, a.pos) < 1.5 || w.now > b.holdUntil) {
      if (maybeStartClimb(a, w.climbs, w.agents, w.now)) return;
      b.goal = w.objective(a);
      b.holdUntil = w.now + 3;
      b.repathAt = 0;
    }
    if (!b.goal) return;
    goal = b.goal;
  } else {
    if (!b.goal) b.goal = chooseObjective(a, w);
    if (dist2(b.goal, a.pos) < 2.5) {
      if (!b.holdUntil) b.holdUntil = w.now + rand(2, a.team === 'CT' && w.liveTime < 30 ? 14 : 5);
      else if (w.now > b.holdUntil) {
        b.goal = chooseObjective(a, w);
        b.holdUntil = 0;
      }
    }
    goal = b.goal;
    holding = b.holdUntil > 0;
  }
  const next = holding ? null : direct ? goal : follow(a, w, goal);
  if (next) {
    const [sx, sz] = direct ? [next.x - a.pos.x, next.z - a.pos.z] : avoid(a, w, next.x - a.pos.x, next.z - a.pos.z);
    steer(a, sx, sz);
    a.input.walk = quiet;
    const look = b.lastKnown ? b.lastKnown : new THREE.Vector3(next.x, a.pos.y, next.z);
    turnTo(a, anglesTo(a.pos, look)[0], 0, sk.turn * 0.6, dt);
    // stuck on a corner: repath and sidestep
    b.stuckT = a.speed2d < 0.6 ? b.stuckT + dt : 0;
    if (b.stuckT > 0.7) {
      if (b.climb) endClimb(a, w.now);
      b.stuckT = 0;
      b.unstickT = 0.6;
      b.strafe = Math.random() < 0.5 ? -1 : 1;
      b.repathAt = 0;
    }
    if (b.unstickT > 0) {
      b.unstickT -= dt;
      a.input.r = b.strafe;
      a.input.f = -0.3;
      a.input.jump = b.unstickT > 0.45;
    }
  } else {
    // look toward the enemy side while holding a spot
    const enemy = a.team === 'CT' ? w.points.hold.T[0] : w.points.hold.CT[0];
    const [yaw] = anglesTo(a.pos, new THREE.Vector3(enemy.x, a.pos.y, enemy.z));
    turnTo(a, yaw + Math.sin(w.now * 0.6 + a.id) * 0.5, 0, 2, dt);
  }
}
