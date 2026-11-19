import { angleDiff } from '../../core/agents/agent';
import type { NavGrid, P2 } from '../../core/agents/nav';
import { distance2d, yawToward } from '../map/streetSampling';
import type { Vehicle } from './Vehicle';

/** How a city driver drives: calm traffic, a police chase, a runaway, or a car pulling over. */
export type DriveMode = 'cruise' | 'chase' | 'flee' | 'stop';

export interface CarAi {
  mode: DriveMode;
  goal: P2 | null;
  path: P2[];
  repathAt: number;
  stuckFor: number;
  reverseFor: number;
  /** Steering held while backing out of a dead end (-1 / 1). */
  reverseSteer: number;
}

/** What a driver sees on the road ahead. */
export interface RoadAhead {
  /** Distance (m) to the nearest car or person in the car's lane ahead, Infinity when the way is clear. */
  obstacleAt(vehicle: Vehicle, rangeM: number): number;
  /** A car fits at x/z (for keeping to the right-hand lane). */
  isDrivable(x: number, z: number): boolean;
}

const SPEED: Record<DriveMode, number> = { cruise: 11, chase: 24, flee: 21, stop: 0 };
const REPATH_S: Record<DriveMode, number> = { cruise: 8, chase: 1.5, flee: 3, stop: 99 };
/** Drive this far right of the path's middle (two-way streets). */
const LANE_OFFSET_M = 2.4;
const WAYPOINT_REACHED_M = 7;
const STEER_GAIN = 2.2;
const SLOW_FOR_TURN = 0.75;
const BRAKE_DISTANCE_M = 8;
const LOOK_AHEAD_M = 16;
const STUCK_SPEED = 0.6;
const STUCK_AFTER_S = 2.2;
const REVERSE_S = 1.4;

export const newCarAi = (mode: DriveMode, goal: P2 | null = null): CarAi => ({ mode, goal, path: [], repathAt: 0, stuckFor: 0, reverseFor: 0, reverseSteer: 1 });

/**
 * Sets a city driver's controls for this frame: follow the path on the car grid in the right-hand lane, slow into turns,
 * brake for what is ahead (a runaway does not), back out when stuck.
 */
export function driveCar(vehicle: Vehicle, ai: CarAi, nav: NavGrid, road: RoadAhead, now: number, dt: number) {
  const c = vehicle.controls;
  const s = vehicle.state;
  c.handbrake = false;
  if (ai.mode === 'stop' || !ai.goal) {
    c.throttle = s.speed > 0.5 ? -1 : 0;
    c.steer = 0;
    return;
  }
  if (ai.reverseFor > 0) {
    ai.reverseFor -= dt;
    c.throttle = -0.8;
    c.steer = ai.reverseSteer;
    return;
  }
  if (!ai.path.length || now > ai.repathAt) {
    ai.path = nav.path(s, ai.goal);
    ai.repathAt = now + REPATH_S[ai.mode];
  }
  while (ai.path.length > 1 && distance2d(ai.path[0], s) < WAYPOINT_REACHED_M) ai.path.shift();
  const next = ai.path[0] ?? ai.goal;
  const target = keepRight(s, next, road);
  const err = angleDiff(yawToward(s, target), s.heading);
  c.steer = Math.max(-1, Math.min(1, -err * STEER_GAIN));
  let want = SPEED[ai.mode] * (1 - Math.min(SLOW_FOR_TURN, Math.abs(err) / 1.4));
  const ahead = road.obstacleAt(vehicle, LOOK_AHEAD_M);
  if (ai.mode !== 'flee') {
    if (ahead < BRAKE_DISTANCE_M) want = 0;
    else if (ahead < LOOK_AHEAD_M) want = Math.min(want, (ahead - BRAKE_DISTANCE_M) * 1.2);
  }
  c.throttle = Math.max(-1, Math.min(1, (want - s.speed) * 0.4));
  // wanting to move but not moving (and nothing in the way): back out the other way round and look for another route
  const blocked = want > 2 && s.speed < STUCK_SPEED;
  ai.stuckFor = blocked && ahead > BRAKE_DISTANCE_M ? ai.stuckFor + dt : 0;
  if (ai.stuckFor > STUCK_AFTER_S) {
    ai.stuckFor = 0;
    ai.reverseFor = REVERSE_S;
    ai.reverseSteer = c.steer >= 0 ? -1 : 1;
    ai.repathAt = 0;
  }
}

/** The waypoint moved into the right-hand lane when the road is wide enough there. */
function keepRight(from: P2, to: P2, road: RoadAhead): P2 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 1) return to;
  // right of the travel direction (x east, -z north)
  const rx = -dz / len;
  const rz = dx / len;
  const x = to.x + rx * LANE_OFFSET_M;
  const z = to.z + rz * LANE_OFFSET_M;
  return road.isDrivable(x, z) ? { x, z } : to;
}
