import { angleDiff, idleInput, type Agent } from '../../core/agents/agent';
import type { P2 } from '../../core/agents/nav';
import type { CityMap } from '../map/cityWorld';
import { distance2d, randomStreetPoint, yawToward } from '../map/streetSampling';
import type { CityNpcs } from './cityNpcs';
import { civilianLook } from './npcLooks';

/** Passers-by kept around the player (more would cost frame time for little). */
const POPULATION = 16;
const SPAWN_MIN_M = 45;
const SPAWN_MAX_M = 120;
const DESPAWN_M = 170;
/** A body stays this long before it is cleared away (s). */
const BODY_STAYS_S = 25;
const WANDER_MIN_M = 25;
const WANDER_MAX_M = 75;
const PANIC_S = 9;
const FLEE_DISTANCE_M = 45;
const TURN_RATE = 6;
const ARRIVE_M = 1.6;
const REPATH_S = 4;
const NAMES = ['Người đi đường', 'Cư dân', 'Khách bộ hành', 'Nhân viên văn phòng', 'Sinh viên', 'Người bán hàng'];

interface CivilianMind {
  goal: P2 | null;
  path: P2[];
  repathAt: number;
  idleUntil: number;
  panicUntil: number;
  fleeFrom: P2 | null;
}

/** The city's passers-by: kept around the player, wandering the streets and running from gunfire and crashes. */
export class Civilians {
  private readonly minds = new WeakMap<Agent, CivilianMind>();

  constructor(
    private readonly map: CityMap,
    private readonly npcs: CityNpcs,
    private readonly random: () => number,
  ) {}

  /** Keeps the crowd around the player: clears the far and the long dead, fills up to the population. */
  maintain(player: P2, now: number) {
    for (const a of this.npcs.all('civilian')) {
      const far = distance2d(a.pos, player) > DESPAWN_M;
      if (far || (!a.alive && now - a.diedAt > BODY_STAYS_S)) this.npcs.remove(a);
    }
    if (this.npcs.count('civilian') >= POPULATION) return;
    const at = randomStreetPoint(this.map, player, SPAWN_MIN_M, SPAWN_MAX_M, this.random);
    if (!at) return;
    const name = NAMES[Math.floor(this.random() * NAMES.length)] ?? NAMES[0];
    const a = this.npcs.spawn('civilian', name, civilianLook(this.random), at.x, at.z, this.random() * Math.PI * 2, null);
    this.minds.set(a, newMind());
  }

  /** Everyone within `radius` of a threat runs away from it (gunfire, a crash, a body). */
  scare(at: P2, radius: number, now: number) {
    for (const a of this.npcs.all('civilian')) {
      if (!a.alive || distance2d(a.pos, at) > radius) continue;
      const mind = this.mindOf(a);
      mind.panicUntil = now + PANIC_S;
      mind.fleeFrom = { x: at.x, z: at.z };
      mind.goal = null;
      mind.path = [];
    }
  }

  isPanicking(a: Agent, now: number) {
    return this.mindOf(a).panicUntil > now;
  }

  /** One passer-by's walk this frame: wander between street spots, or run from the last threat. */
  think(a: Agent, now: number, dt: number) {
    a.input = idleInput();
    if (!a.alive) return;
    const mind = this.mindOf(a);
    const panicking = mind.panicUntil > now;
    if (!panicking && now < mind.idleUntil) return;
    if (!mind.goal) mind.goal = this.chooseGoal(a, mind, panicking);
    if (!mind.goal) return;
    if (distance2d(a.pos, mind.goal) < ARRIVE_M * 2) {
      mind.goal = null;
      mind.path = [];
      if (!panicking) mind.idleUntil = now + 2 + this.random() * 5;
      return;
    }
    if (!mind.path.length || now > mind.repathAt) {
      mind.path = this.map.nav.path(a.pos, mind.goal);
      mind.repathAt = now + REPATH_S;
      if (!mind.path.length) {
        mind.goal = null;
        return;
      }
    }
    while (mind.path.length && distance2d(mind.path[0], a.pos) < ARRIVE_M) mind.path.shift();
    const next = mind.path[0] ?? mind.goal;
    const want = yawToward(a.pos, next);
    const turn = Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, angleDiff(want, a.yaw)));
    a.yaw += turn;
    a.pitch = 0;
    a.input.f = Math.abs(angleDiff(want, a.yaw)) < 1.2 ? 1 : 0.2;
    a.input.walk = !panicking;
    a.input.sprint = panicking;
  }

  private chooseGoal(a: Agent, mind: CivilianMind, panicking: boolean): P2 | null {
    if (panicking && mind.fleeFrom) {
      const away = yawToward(mind.fleeFrom, a.pos);
      const x = a.pos.x - Math.sin(away) * FLEE_DISTANCE_M;
      const z = a.pos.z - Math.cos(away) * FLEE_DISTANCE_M;
      if (this.map.isStreet(x, z)) return { x, z };
    }
    return randomStreetPoint(this.map, a.pos, WANDER_MIN_M, WANDER_MAX_M, this.random);
  }

  private mindOf(a: Agent): CivilianMind {
    let mind = this.minds.get(a);
    if (!mind) {
      mind = newMind();
      this.minds.set(a, mind);
    }
    return mind;
  }
}

const newMind = (): CivilianMind => ({ goal: null, path: [], repathAt: 0, idleUntil: 0, panicUntil: 0, fleeFrom: null });
