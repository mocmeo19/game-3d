import type { P2 } from './nav';

/** A watchtower bots can climb: the path grid only knows the ground, so the stairs are walked along fixed waypoints. */
export interface Climb {
  /** Open ground in front of the stairs, reached over the path grid. */
  foot: P2;
  /** From the foot up the stairs to the middle of the floor. */
  up: readonly P2[];
  /** From the middle of the floor down the stairs to the foot. */
  down: readonly P2[];
}

type ClimbStage = 'approach' | 'up' | 'perch' | 'down';

export interface ClimbPlan {
  tower: Climb;
  stage: ClimbStage;
  route: P2[];
  stageStartedAt: number;
  perchUntil: number;
}

/** What a climbing bot does this frame: walk over the grid, step straight along the stairs, or keep watch on top. */
export type ClimbStep = { kind: 'walk'; point: P2 } | { kind: 'direct'; point: P2 } | { kind: 'perch' };

const CLIMB_CHANCE = 0.3;
const TOWER_REACH_M = 45;
const CLIMB_COOLDOWN_S = 90;
const APPROACH_TIMEOUT_S = 35;
const STAIRS_TIMEOUT_S = 15;
const PERCH_SECONDS: [number, number] = [14, 28];
const FOOT_REACHED_M = 1;
const WAYPOINT_REACHED_M = 0.35;

/** The part of a bot a climb reads and writes (kept structural so this module does not depend on the agent and brain modules). */
interface Climber {
  pos: P2;
  brain: { climb: ClimbPlan | null; climbedAt: number } | null;
}

const distance = (a: Climber, p: P2) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z);

/** Sometimes sends a bot up a free tower nearby; returns whether it now climbs. */
export function maybeStartClimb(a: Climber, climbs: readonly Climb[], climbers: readonly Climber[], now: number): boolean {
  const brain = a.brain;
  if (!brain || brain.climb || now - brain.climbedAt < CLIMB_COOLDOWN_S || Math.random() > CLIMB_CHANCE) return false;
  const taken = new Set(climbers.map((other) => other.brain?.climb?.tower));
  const tower = climbs.find((climb) => !taken.has(climb) && distance(a, climb.foot) < TOWER_REACH_M);
  if (!tower) return false;
  brain.climb = { tower, stage: 'approach', route: [], stageStartedAt: now, perchUntil: 0 };
  return true;
}

export function endClimb(a: Climber, now: number) {
  if (!a.brain) return;
  a.brain.climb = null;
  a.brain.climbedAt = now;
}

function enterStage(plan: ClimbPlan, stage: ClimbStage, now: number) {
  plan.stage = stage;
  plan.stageStartedAt = now;
  plan.route = stage === 'up' ? [...plan.tower.up] : stage === 'down' ? [...plan.tower.down] : [];
}

/** Advances a bot's climb and says where it heads now; null once the climb is over (done or given up). */
export function nextClimbStep(a: Climber, now: number): ClimbStep | null {
  const plan = a.brain?.climb;
  if (!plan) return null;
  if (plan.stage === 'approach') {
    if (distance(a, plan.tower.foot) < FOOT_REACHED_M) enterStage(plan, 'up', now);
    else if (now - plan.stageStartedAt > APPROACH_TIMEOUT_S) return giveUp(a, now);
    else return { kind: 'walk', point: plan.tower.foot };
  }
  if (plan.stage === 'perch') {
    if (now < plan.perchUntil) return { kind: 'perch' };
    enterStage(plan, 'down', now);
  }
  while (plan.route.length && distance(a, plan.route[0]) < WAYPOINT_REACHED_M) plan.route.shift();
  if (!plan.route.length) {
    if (plan.stage === 'down') return giveUp(a, now);
    enterStage(plan, 'perch', now);
    plan.perchUntil = now + PERCH_SECONDS[0] + Math.random() * (PERCH_SECONDS[1] - PERCH_SECONDS[0]);
    return { kind: 'perch' };
  }
  if (now - plan.stageStartedAt > STAIRS_TIMEOUT_S) return giveUp(a, now);
  return { kind: 'direct', point: plan.route[0] };
}

function giveUp(a: Climber, now: number): null {
  endClimb(a, now);
  return null;
}
