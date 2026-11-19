import type * as THREE from 'three';
import type { Agent } from '../../core/agents/agent';
import type { P2 } from '../../core/agents/nav';
import type { WeaponId } from '../../core/rules';
import type { CityMap } from '../map/cityWorld';
import { distance2d, randomStreetPoint, yawToward } from '../map/streetSampling';
import type { CityNpcs } from '../npc/cityNpcs';
import { policeLook, swatLook } from '../npc/npcLooks';
import { newCarAi } from '../vehicles/carDriver';
import type { VehicleFleet } from '../vehicles/fleet';
import type { Traffic } from '../vehicles/traffic';
import type { Vehicle } from '../vehicles/Vehicle';
import type { WantedState } from './wanted';

/** Officers on foot and patrol cars hunting the player, by stars. */
const OFFICERS = [0, 2, 4, 6, 7, 9] as const;
const CARS = [0, 1, 2, 2, 3, 3] as const;
const OFFICER_WEAPON: readonly WeaponId[] = ['usp', 'usp', 'usp', 'mp9', 'm4a4', 'm4a4'];
const SWAT_FROM_STARS = 4;
const OFFICER_SPAWN_MIN_M = 60;
const OFFICER_SPAWN_MAX_M = 130;
const CAR_SPAWN_MIN_M = 130;
const CAR_SPAWN_MAX_M = 230;
const DESPAWN_M = 220;
/** Out of the chase, police further than this from the player leave. */
const STAND_DOWN_M = 60;
const SIGHT_M = 90;
const CAR_SIGHT_M = 45;
/** A patrol car pulls up this close (m) and an officer gets out. */
const BAIL_OUT_M = 22;
const BUST_REACH_M = 2.5;
const BUST_HOLD_S = 2.2;
/** The player fired this recently (s): no arrest, the police shoot instead. */
const FIGHTING_BACK_S = 2.5;
/** From this many stars patrol cars ram the player's car instead of braking for it. */
const RAMS_FROM_STARS = 3;

/** What the police report each frame. */
export interface PoliceReport {
  /** An officer or a patrol car can see the player. */
  seen: boolean;
  /** 0..1 of the arrest (an officer hands-on and the player not fighting back); 1 = busted. */
  bust: number;
}

/** The police force: officers and patrol cars that come with stars, hunt the player and stand down when the stars are gone. */
export class PoliceForce {
  private readonly bailedOut = new WeakSet<Vehicle>();
  private readonly cars = new Set<Vehicle>();
  private bustFor = 0;

  constructor(
    private readonly map: CityMap,
    private readonly fleet: VehicleFleet,
    private readonly traffic: Traffic,
    private readonly npcs: CityNpcs,
    private readonly random: () => number,
    private readonly canSee: (from: THREE.Vector3, to: THREE.Vector3) => boolean,
  ) {}

  /** Where an officer heads: where the player was last seen, or nowhere when the chase is over. */
  objective(officer: Agent, wanted: WantedState): P2 | null {
    if (!wanted.stars || !wanted.lastSeen) return { x: officer.pos.x, z: officer.pos.z };
    return wanted.lastSeen;
  }

  update(dt: number, player: Agent, wanted: WantedState, firedAt: number, now: number): PoliceReport {
    const stars = wanted.stars;
    this.cullAndStandDown(player.pos, stars);
    if (stars > 0) {
      if (this.npcs.count('police') < OFFICERS[stars]) this.spawnOfficer(player.pos, stars);
      if (this.cars.size < CARS[stars]) this.spawnCar(player.pos);
    }
    this.driveCars(player, stars);
    const seen = stars > 0 && this.sees(player);
    return { seen, bust: this.arrest(dt, player, stars, now - firedAt < FIGHTING_BACK_S) };
  }

  private spawnOfficer(player: P2, stars: number) {
    const at = randomStreetPoint(this.map, player, OFFICER_SPAWN_MIN_M, OFFICER_SPAWN_MAX_M, this.random);
    if (!at) return;
    const swat = stars >= SWAT_FROM_STARS;
    this.npcs.spawn('police', swat ? 'Đặc nhiệm' : 'Cảnh sát', swat ? swatLook(this.random) : policeLook(this.random), at.x, at.z, yawToward(at, player), OFFICER_WEAPON[stars]);
  }

  private spawnCar(player: P2) {
    const at = randomStreetPoint(this.map, player, CAR_SPAWN_MIN_M, CAR_SPAWN_MAX_M, this.random, true);
    if (!at) return;
    const car = this.fleet.spawn('police', at.x, at.z, yawToward(at, player), this.random);
    car.sirenOn = true;
    car.isKept = true;
    this.cars.add(car);
    this.traffic.assign(car, newCarAi('chase', { x: player.x, z: player.z }));
  }

  private driveCars(player: Agent, stars: number) {
    if (!stars) return;
    const playerDriving = !!player.gear?.isAboard;
    for (const car of this.cars) {
      const ai = this.traffic.aiOf(car);
      if (!ai) continue;
      ai.goal = { x: player.pos.x, z: player.pos.z };
      if (!playerDriving && distance2d(car.state, player.pos) < BAIL_OUT_M) {
        ai.mode = 'stop';
        if (!this.bailedOut.has(car) && Math.abs(car.state.speed) < 1) {
          this.bailedOut.add(car);
          const x = car.state.x + Math.cos(car.state.heading) * 2;
          const z = car.state.z - Math.sin(car.state.heading) * 2;
          this.npcs.spawn('police', 'Cảnh sát', policeLook(this.random), x, z, car.state.heading, 'usp');
        }
        continue;
      }
      // a runaway driver does not brake: from three stars patrol cars ram the player's car
      ai.mode = stars >= RAMS_FROM_STARS && playerDriving ? 'flee' : 'chase';
    }
  }

  /** Police too far away go; with no stars left, every officer and car out of the player's way goes too. */
  private cullAndStandDown(player: P2, stars: number) {
    for (const officer of this.npcs.all('police')) {
      const d = distance2d(officer.pos, player);
      if (d > DESPAWN_M || (!stars && d > STAND_DOWN_M) || (!officer.alive && d > STAND_DOWN_M)) this.npcs.remove(officer);
    }
    for (const car of [...this.cars]) {
      if (car.driver === 'player') {
        this.cars.delete(car);
        continue;
      }
      const d = distance2d(car.state, player);
      if (car.isWrecked || d > DESPAWN_M || (!stars && d > STAND_DOWN_M)) {
        this.cars.delete(car);
        this.traffic.release(car);
        this.fleet.remove(car);
        continue;
      }
      if (!stars) {
        car.sirenOn = false;
        const ai = this.traffic.aiOf(car);
        if (ai) ai.mode = 'stop';
      }
    }
  }

  private sees(player: Agent): boolean {
    const chest = player.chest();
    for (const officer of this.npcs.all('police')) {
      if (!officer.alive || distance2d(officer.pos, player.pos) > SIGHT_M) continue;
      if (this.canSee(officer.eye(), chest)) return true;
    }
    for (const car of this.cars) if (!car.isWrecked && distance2d(car.state, player.pos) < CAR_SIGHT_M) return true;
    return false;
  }

  private arrest(dt: number, player: Agent, stars: number, fightingBack: boolean): number {
    const handsOn =
      stars > 0 && player.alive && !player.gear?.isAboard && !fightingBack &&
      this.npcs.all('police').some((o) => o.alive && distance2d(o.pos, player.pos) < BUST_REACH_M);
    this.bustFor = handsOn ? this.bustFor + dt : Math.max(0, this.bustFor - dt * 2);
    return Math.min(1, this.bustFor / BUST_HOLD_S);
  }

  /** Every officer and car leaves at once (after a respawn). */
  clear() {
    for (const officer of this.npcs.all('police')) this.npcs.remove(officer);
    for (const car of this.cars) {
      this.traffic.release(car);
      if (car.driver !== 'player') this.fleet.remove(car);
    }
    this.cars.clear();
    this.bustFor = 0;
  }
}
