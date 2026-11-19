import type { Agent } from '../../core/agents/agent';
import type { P2 } from '../../core/agents/nav';
import type { CityMap } from '../map/cityWorld';
import { distance2d, randomStreetPoint, yawToward } from '../map/streetSampling';
import { driveCar, newCarAi, type CarAi, type RoadAhead } from './carDriver';
import type { VehicleFleet } from './fleet';
import type { Vehicle } from './Vehicle';
import { pickTrafficKind } from './vehicleSpecs';

const MOVING_CARS = 12;
const PARKED_CARS = 6;
const SPAWN_MIN_M = 90;
const SPAWN_MAX_M = 230;
const PARK_MIN_M = 30;
const PARK_MAX_M = 120;
const DESPAWN_M = 300;
const TRIP_MIN_M = 150;
const TRIP_MAX_M = 450;
const ARRIVED_M = 12;
/** Clearance (cells) of a parking spot: the edge of a drivable street, out of the traffic's way. */
const KERB_CLEARANCE = 3;
/** Half-width (m) of the lane a driver watches ahead, beyond its own car's half width. */
const LANE_MARGIN_M = 1.1;

/**
 * The city's drivers: keeps moving traffic and parked cars around the player and drives every car the city controls
 * (traffic, police, a mission's runaway) through `driveCar`.
 */
export class Traffic implements RoadAhead {
  private readonly drivers = new Map<Vehicle, CarAi>();

  constructor(
    private readonly map: CityMap,
    private readonly fleet: VehicleFleet,
    private readonly people: () => readonly Agent[],
    private readonly random: () => number,
  ) {}

  /** A city driver takes the wheel of a car. */
  assign(vehicle: Vehicle, ai: CarAi) {
    vehicle.driver = 'ai';
    this.drivers.set(vehicle, ai);
  }

  /** The city's driver leaves the car (pulled out by the player, or the car is gone). */
  release(vehicle: Vehicle) {
    this.drivers.delete(vehicle);
    if (vehicle.driver === 'ai') vehicle.driver = 'none';
  }

  aiOf(vehicle: Vehicle): CarAi | null {
    return this.drivers.get(vehicle) ?? null;
  }

  /** Clears far cars and adds moving and parked ones until the street around the player is busy enough. */
  maintain(player: P2) {
    let moving = 0;
    let parked = 0;
    for (const v of [...this.fleet.vehicles]) {
      if (v.isKept || v.driver === 'player') continue;
      if (distance2d(v.state, player) > DESPAWN_M) {
        this.release(v);
        this.fleet.remove(v);
        continue;
      }
      if (this.drivers.get(v)?.mode === 'cruise') moving++;
      else if (v.driver === 'none') parked++;
    }
    if (moving < MOVING_CARS) this.spawnMoving(player);
    if (parked < PARKED_CARS) this.spawnParked(player);
  }

  private spawnMoving(player: P2) {
    const at = randomStreetPoint(this.map, player, SPAWN_MIN_M, SPAWN_MAX_M, this.random, true);
    if (!at) return;
    const goal = randomStreetPoint(this.map, at, TRIP_MIN_M, TRIP_MAX_M, this.random, true);
    if (!goal) return;
    const path = this.map.carNav.path(at, goal);
    if (path.length < 2) return;
    const car = this.fleet.spawn(pickTrafficKind(this.random), at.x, at.z, yawToward(at, path[0]), this.random);
    const ai = newCarAi('cruise', goal);
    ai.path = path;
    car.state.speed = 6;
    this.assign(car, ai);
  }

  private spawnParked(player: P2) {
    const { grid, masks } = this.map.ground;
    for (let i = 0; i < 12; i++) {
      const at = randomStreetPoint(this.map, player, PARK_MIN_M, PARK_MAX_M, this.random, true, 4);
      if (!at) continue;
      const k = grid.index(at.x, at.z);
      if (masks.clearance[k] !== KERB_CLEARANCE) continue;
      // clearance grows across the street, so the kerb runs at right angles to its gradient
      const gx = masks.clearance[k + 1] - masks.clearance[k - 1];
      const gz = masks.clearance[k + grid.cols] - masks.clearance[k - grid.cols];
      const heading = Math.atan2(gz, -gx) + (this.random() < 0.5 ? 0 : Math.PI);
      this.fleet.spawn(pickTrafficKind(this.random), at.x, at.z, heading, this.random);
      return;
    }
  }

  /** Every city driver drives one frame; cruising cars and runaways pick a new trip once they arrive (police keep theirs). */
  drive(now: number, dt: number) {
    for (const [v, ai] of this.drivers) {
      if (v.isWrecked) {
        this.release(v);
        continue;
      }
      const wanders = ai.mode === 'cruise' || (ai.mode === 'flee' && v.spec.kind !== 'police');
      if (wanders && ai.goal && distance2d(v.state, ai.goal) < ARRIVED_M) {
        ai.goal = randomStreetPoint(this.map, v.state, TRIP_MIN_M, TRIP_MAX_M, this.random, true);
        ai.path = [];
      }
      driveCar(v, ai, this.map.carNav, this, now, dt);
    }
  }

  obstacleAt(vehicle: Vehicle, rangeM: number): number {
    const s = vehicle.state;
    const dir = Math.sign(s.speed) || 1;
    const fx = -Math.sin(s.heading) * dir;
    const fz = -Math.cos(s.heading) * dir;
    const half = vehicle.spec.length / 2;
    const lane = vehicle.spec.width / 2 + LANE_MARGIN_M;
    let nearest = Infinity;
    const consider = (x: number, z: number, radius: number) => {
      const dx = x - s.x;
      const dz = z - s.z;
      const along = dx * fx + dz * fz - half - radius;
      if (along < -0.5 || along > rangeM) return;
      const across = Math.abs(dx * -fz + dz * fx);
      if (across < lane + radius) nearest = Math.min(nearest, Math.max(0, along));
    };
    for (const other of this.fleet.vehicles) if (other !== vehicle) consider(other.state.x, other.state.z, other.spec.length / 2);
    for (const a of this.people()) if (a.alive && !a.gear?.isAboard) consider(a.pos.x, a.pos.z, 0.4);
    return nearest;
  }

  isDrivable(x: number, z: number) {
    return this.map.isDrivable(x, z);
  }

  clear() {
    for (const v of [...this.drivers.keys()]) this.release(v);
  }
}
