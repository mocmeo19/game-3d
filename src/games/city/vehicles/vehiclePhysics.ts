import type { VehicleSpec } from './vehicleSpecs';

/** Arcade car handling on the city's height map. Pure: no three.js, so it can be unit-tested. Heading 0 faces -z like agents. */

export interface VehicleState {
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Signed speed along the heading (m/s, negative in reverse). */
  speed: number;
  /** Current steering, -1 (left) .. 1 (right), eased toward the wheel input. */
  steer: number;
  /** Vertical speed while airborne (m/s). */
  vy: number;
  /** Nose-up tilt from the ground under the wheels (rad). */
  pitch: number;
  onGround: boolean;
}

export interface VehicleControls {
  /** -1 (reverse / brake) .. 1 (full throttle). */
  throttle: number;
  /** -1 (left) .. 1 (right). */
  steer: number;
  handbrake: boolean;
}

/** What the car drives on. */
export interface DriveSurface {
  groundAt(x: number, z: number): number;
  /** A wall at x/z for wheels at height y (a building side, the edge of the world). */
  blocksAt(x: number, z: number, y: number): boolean;
}

export interface StepResult {
  /** Speed lost against a wall this step (m/s), 0 when nothing was hit. */
  impact: number;
}

const GRAVITY = 14;
const ROLLING_DRAG = 1.6;
const AIR_DRAG = 0.0022;
const REVERSE_SHARE = 0.32;
const STEER_RATE = 3.2;
const HANDBRAKE_SHARE = 0.75;
/** Below this speed (m/s) the car steers less, reaching full turn rate at it. */
const FULL_TURN_SPEED = 7;
/** Share of the turn rate left at top speed (stable on the highway). */
const HIGH_SPEED_TURN = 0.45;
const BOUNCE = 0.25;
/** A glancing hit along a wall keeps this share of the speed while it slides. */
const SLIDE_KEEP = 0.7;
/** Drops the wheels follow instead of flying off (m per step). */
const STICK_DROP = 0.35;

export const newVehicleState = (x: number, y: number, z: number, heading: number): VehicleState => ({
  x, y, z, heading, speed: 0, steer: 0, vy: 0, pitch: 0, onGround: true,
});

const approach = (value: number, target: number, step: number) => (value < target ? Math.min(target, value + step) : Math.max(target, value - step));

/** The speed after throttle, brakes and drag for one step. */
export function nextSpeed(speed: number, spec: VehicleSpec, controls: VehicleControls, dt: number): number {
  let v = speed;
  const t = controls.throttle;
  // the pull fades toward top speed (squared, so most of it is reached quickly); drag only slows a coasting car
  if (t > 0) v = v < 0 ? Math.min(0, v + spec.brake * dt) : Math.min(spec.topSpeed, v + spec.accel * t * (1 - (Math.max(0, v) / spec.topSpeed) ** 2) * dt);
  else if (t < 0) v = v > 0.3 ? Math.max(0, v - spec.brake * -t * dt) : Math.max(-spec.topSpeed * REVERSE_SHARE, v + spec.accel * t * 0.6 * dt);
  else v = approach(v, 0, (ROLLING_DRAG + AIR_DRAG * v * v) * dt);
  if (controls.handbrake) v = approach(v, 0, spec.brake * HANDBRAKE_SHARE * dt);
  return v;
}

/** Yaw rate (rad/s) for the current steering and speed. */
export function yawRate(state: VehicleState, spec: VehicleSpec, handbrake: boolean): number {
  const speedShare = Math.max(-1, Math.min(1, state.speed / FULL_TURN_SPEED));
  const highSpeed = 1 - (1 - HIGH_SPEED_TURN) * Math.min(1, Math.abs(state.speed) / spec.topSpeed);
  const drift = handbrake && Math.abs(state.speed) > 6 ? 1.6 : 1;
  return -state.steer * spec.turnRate * speedShare * highSpeed * drift;
}

/** The front (or back, in reverse) bumper and its corners at a position, where walls are looked for. */
function bumperPoints(x: number, z: number, heading: number, spec: VehicleSpec, forward: boolean): [number, number][] {
  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const along = (forward ? 1 : -1) * spec.length * 0.48;
  const side = spec.width * 0.42;
  return [
    [x + fx * along, z + fz * along],
    [x + fx * along + rx * side, z + fz * along + rz * side],
    [x + fx * along - rx * side, z + fz * along - rz * side],
  ];
}

function hitsWall(surface: DriveSurface, x: number, z: number, heading: number, spec: VehicleSpec, forward: boolean, y: number) {
  return bumperPoints(x, z, heading, spec, forward).some(([px, pz]) => surface.blocksAt(px, pz, y));
}

/** One physics step: speed, steering, moving with wall hits and slides, then the wheels onto the ground or a fall. */
export function stepVehicle(state: VehicleState, spec: VehicleSpec, controls: VehicleControls, dt: number, surface: DriveSurface): StepResult {
  state.steer = approach(state.steer, controls.steer, STEER_RATE * dt);
  if (state.onGround) {
    state.speed = nextSpeed(state.speed, spec, controls, dt);
    state.heading += yawRate(state, spec, controls.handbrake) * dt;
  }
  const forward = state.speed >= 0;
  const dx = -Math.sin(state.heading) * state.speed * dt;
  const dz = -Math.cos(state.heading) * state.speed * dt;
  let impact = 0;
  if (!hitsWall(surface, state.x + dx, state.z + dz, state.heading, spec, forward, state.y)) {
    state.x += dx;
    state.z += dz;
  } else if (!hitsWall(surface, state.x + dx, state.z, state.heading, spec, forward, state.y) && Math.abs(dx) > Math.abs(dz) * 0.35) {
    state.x += dx;
    impact = Math.abs(state.speed) * (1 - SLIDE_KEEP);
    state.speed *= SLIDE_KEEP;
  } else if (!hitsWall(surface, state.x, state.z + dz, state.heading, spec, forward, state.y) && Math.abs(dz) > Math.abs(dx) * 0.35) {
    state.z += dz;
    impact = Math.abs(state.speed) * (1 - SLIDE_KEEP);
    state.speed *= SLIDE_KEEP;
  } else {
    impact = Math.abs(state.speed);
    state.speed = -state.speed * BOUNCE;
  }
  settleOnGround(state, spec, dt, surface);
  return { impact };
}

function settleOnGround(state: VehicleState, spec: VehicleSpec, dt: number, surface: DriveSurface) {
  const ground = surface.groundAt(state.x, state.z);
  if (state.onGround && state.y - ground > STICK_DROP) {
    state.onGround = false;
    state.vy = 0;
  }
  if (!state.onGround) {
    state.vy -= GRAVITY * dt;
    state.y += state.vy * dt;
    if (state.y <= ground) {
      state.y = ground;
      state.vy = 0;
      state.onGround = true;
    }
  } else state.y = ground;
  const half = spec.length * 0.4;
  const fx = -Math.sin(state.heading) * half;
  const fz = -Math.cos(state.heading) * half;
  const front = surface.groundAt(state.x + fx, state.z + fz);
  const back = surface.groundAt(state.x - fx, state.z - fz);
  const tilt = Math.atan2(front - back, half * 2);
  state.pitch = state.onGround && Math.abs(tilt) < 0.5 ? tilt : state.pitch * 0.95;
}

/** Corners of the car's footprint (x, z), for a point-inside test or a bounding box. */
export function footprint(state: VehicleState, spec: VehicleSpec, pad = 0): [number, number][] {
  const fx = -Math.sin(state.heading);
  const fz = -Math.cos(state.heading);
  const rx = Math.cos(state.heading);
  const rz = -Math.sin(state.heading);
  const hl = spec.length / 2 + pad;
  const hw = spec.width / 2 + pad;
  return [
    [state.x + fx * hl + rx * hw, state.z + fz * hl + rz * hw],
    [state.x + fx * hl - rx * hw, state.z + fz * hl - rz * hw],
    [state.x - fx * hl - rx * hw, state.z - fz * hl - rz * hw],
    [state.x - fx * hl + rx * hw, state.z - fz * hl + rz * hw],
  ];
}

/** x/z inside the car's footprint grown by `pad` (m). */
export function insideFootprint(state: VehicleState, spec: VehicleSpec, x: number, z: number, pad = 0): boolean {
  const dx = x - state.x;
  const dz = z - state.z;
  const along = dx * -Math.sin(state.heading) + dz * -Math.cos(state.heading);
  const across = dx * Math.cos(state.heading) + dz * -Math.sin(state.heading);
  return Math.abs(along) <= spec.length / 2 + pad && Math.abs(across) <= spec.width / 2 + pad;
}
