import * as THREE from 'three';
import type { Agent } from './agent';
import { activeWeapon, blocked, groundHeight, maxSpeed, MOVE, WEAPONS, type Solid } from '../rules';
import { terrainFloor, waterStateAt, type Terrain, type WaterState } from '../world/terrain';

/** Time to lie down or get up (s). */
const PRONE_SECONDS = 0.7;
/** How much lower the collision box is lying down than standing (m). */
const PRONE_HEIGHT_DROP = 1.2;
/** Speed in the water, as a fraction of the speed on land. */
const WATER_SPEED: Record<WaterState, number> = { dry: 1, wading: 0.55, swimming: 0.42 };
/** Walking down a slope or stairs keeps the feet on the ground when it drops less than this in one frame (m). */
const STEP_DOWN = 0.45;
const TAGGED_SPEED = 0.45;

/** What moving an agent reads from the match. */
export interface MovementWorld {
  solids: Solid[];
  terrain: Terrain;
  agents: readonly Agent[];
  now: number;
  /** Freeze time: nobody moves. */
  frozen: boolean;
  /** The player holds the prone stance. */
  playerProne: boolean;
  /** The player's aim mode slows walking (down the sights). */
  playerAimSlows: boolean;
  onLand(a: Agent): void;
  onFootstep(a: Agent): void;
}

/** Feet height of the highest surface under x/z: a box top, the ground, or a swimmer's floating height. */
export function floorAt(world: Pick<MovementWorld, 'solids' | 'terrain'>, x: number, z: number, y: number, radius: number = MOVE.radius): number {
  return groundHeight(x, z, world.solids, y, radius, terrainFloor(world.terrain, x, z));
}

/** A frame of walking, jumping, falling, stance changes and swimming for one living agent. */
export function moveAgent(a: Agent, dt: number, world: MovementWorld) {
  const inp = a.input;
  const frozen = world.frozen;
  const w = activeWeapon(a.inv);
  const water = waterStateAt(world.terrain, a.pos.x, a.pos.z);
  a.swimming = water === 'swimming';
  // a jump from a crouch stands the body up and keeps it up until it lands: holding crouch in the air must not pull it back down
  a.crouch = THREE.MathUtils.clamp(a.crouch + (inp.crouch && a.onGround && !a.swimming ? 1 : -1) * dt * (a.onGround ? 6 : 12), 0, 1);
  const wantProne = a.isPlayer && a.alive && world.playerProne && a.onGround && !a.swimming;
  a.prone = THREE.MathUtils.clamp(a.prone + (wantProne ? 1 : -1) * (dt / PRONE_SECONDS), 0, 1);
  const wasSprinting = a.sprinting;
  a.sprinting = inp.sprint && a.prone < 0.1 && a.crouch < 0.1 && !frozen && !a.swimming;
  // the player's rifle rides on the back during a sprint: after it, it has to be drawn again before it can fire
  if (a.isPlayer && wasSprinting && !a.sprinting && w && WEAPONS[w.id].slot === 1) w.deployLeft = Math.max(w.deployLeft, WEAPONS[w.id].deploy);
  const gait = a.prone > 0.5 ? 'prone' : a.sprinting ? 'sprint' : 'normal';
  let wishX = 0;
  let wishZ = 0;
  if (!frozen && (inp.f || inp.r)) {
    wishX = -Math.sin(a.yaw) * inp.f + Math.cos(a.yaw) * inp.r;
    wishZ = -Math.cos(a.yaw) * inp.f - Math.sin(a.yaw) * inp.r;
    const len = Math.hypot(wishX, wishZ) || 1;
    const scoped = (w?.zoom ?? 0) > 0 || (a.isPlayer && world.playerAimSlows);
    const max =
      maxSpeed(w?.id ?? 'knife', inp.walk || !!a.gear?.isBusy, a.crouch > 0.5, scoped, gait) *
      (world.now < a.tagUntil ? TAGGED_SPEED : 1) *
      (a.gear?.speedFactor() ?? 1) *
      WATER_SPEED[water];
    wishX = (wishX / len) * max;
    wishZ = (wishZ / len) * max;
  }
  if (a.onGround) {
    // accelerate toward the wished velocity; letting go (or counter-strafing) stops fast
    const dx = wishX - a.vel.x;
    const dz = wishZ - a.vel.z;
    const dl = Math.hypot(dx, dz);
    const rate = (wishX || wishZ ? MOVE.accel : MOVE.friction) * dt;
    if (dl <= rate) {
      a.vel.x = wishX;
      a.vel.z = wishZ;
    } else {
      a.vel.x += (dx / dl) * rate;
      a.vel.z += (dz / dl) * rate;
    }
    if (inp.jump && !a.jumpLatch && !frozen && a.prone <= 0 && !a.swimming) {
      // Release the crouch pose on takeoff so a crouch-jump is visibly and
      // physically treated as a jump instead of remaining in the low stance.
      a.crouch = 0;
      a.vel.y = MOVE.jump;
      a.onGround = false;
      a.jumpLatch = true;
    }
  } else if (wishX || wishZ) {
    a.vel.x += THREE.MathUtils.clamp(wishX - a.vel.x, -MOVE.airAccel * dt, MOVE.airAccel * dt);
    a.vel.z += THREE.MathUtils.clamp(wishZ - a.vel.z, -MOVE.airAccel * dt, MOVE.airAccel * dt);
  }
  if (!inp.jump) a.jumpLatch = false;
  if (frozen) a.vel.x = a.vel.z = 0;
  const height = 1.8 - a.crouch * 0.5 - a.prone * PRONE_HEIGHT_DROP;
  const solids = world.solids;
  const moveStartX = a.pos.x;
  const moveStartZ = a.pos.z;
  const attemptedX = a.vel.x;
  const attemptedZ = a.vel.z;
  const nx = a.pos.x + a.vel.x * dt;
  const wall = (x: number, z: number) => blocked(x, z, solids, MOVE.radius, a.pos.y, height) || !!world.terrain.blocksStep?.(x, z, a.pos.y);
  if (!wall(nx, a.pos.z)) a.pos.x = nx;
  else a.vel.x = 0;
  const nz = a.pos.z + a.vel.z * dt;
  if (!wall(a.pos.x, nz)) a.pos.z = nz;
  else a.vel.z = 0;
  // A* uses a coarse grid, so a bot can occasionally face a wall that the
  // route considers open. Probe nearby escape directions when fully blocked.
  if (a.brain && !a.isPlayer && (wishX || wishZ) && Math.hypot(a.pos.x - moveStartX, a.pos.z - moveStartZ) < 0.001) {
    const base = Math.atan2(attemptedZ || wishZ, attemptedX || wishX);
    const step = Math.max(0.08, Math.hypot(attemptedX, attemptedZ) * dt);
    const offsets = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, -(3 * Math.PI) / 4, Math.PI];
    for (const offset of offsets) {
      const angle = base + offset;
      const x = moveStartX + Math.cos(angle) * step;
      const z = moveStartZ + Math.sin(angle) * step;
      if (wall(x, z)) continue;
      a.pos.x = x;
      a.pos.z = z;
      a.vel.x = (x - moveStartX) / Math.max(dt, 1e-3);
      a.vel.z = (z - moveStartZ) / Math.max(dt, 1e-3);
      a.brain.path = [];
      a.brain.repathAt = 0;
      break;
    }
  }
  // keep agents from overlapping
  for (const b of world.agents) {
    if (b === a || !b.alive) continue;
    const dx = a.pos.x - b.pos.x;
    const dz = a.pos.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.001 && d < 0.7 && Math.abs(a.pos.y - b.pos.y) < 1.5) {
      const push = (0.7 - d) * 0.5;
      const px = a.pos.x + (dx / d) * push;
      const pz = a.pos.z + (dz / d) * push;
      if (!wall(px, pz)) a.pos.set(px, a.pos.y, pz);
    }
  }
  // vertical: gravity, landing on the ground or a crate, following slopes down, walking off edges
  const wasAir = !a.onGround;
  const fall = a.vel.y;
  if (!a.onGround) a.vel.y -= MOVE.gravity * dt;
  const prevY = a.pos.y;
  a.pos.y += a.vel.y * dt;
  const ground = floorAt(world, a.pos.x, a.pos.z, Math.max(prevY, a.pos.y));
  if (a.pos.y <= ground) {
    a.pos.y = ground;
    a.vel.y = 0;
    a.onGround = true;
    if (wasAir && fall < -4) world.onLand(a);
  } else if (a.onGround && a.pos.y > ground + 0.05) {
    if (a.pos.y - ground < STEP_DOWN) a.pos.y = ground;
    else a.onGround = false;
  }
  // footsteps: running is loud, walking / crouching is silent (as in CS)
  const speed = a.speed2d;
  if (a.onGround && !a.swimming && speed > MOVE.run * 0.62) {
    a.stepDist += speed * dt;
    if (a.stepDist > 2.4) {
      a.stepDist = 0;
      world.onFootstep(a);
    }
  }
}
